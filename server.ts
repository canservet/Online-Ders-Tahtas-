import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import type { 
  BoardBackgroundType, 
  WhiteboardElement, 
  ChatMessage, 
  UserPresence, 
  RoomState 
} from './src/types/whiteboard.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

app.use(express.json());

interface ClientSocket extends WebSocket {
  isAlive?: boolean;
  userData?: {
    id: string;
    name: string;
    role: 'teacher' | 'student';
    roomId: string;
    color: string;
    handRaised: boolean;
  };
}

class ClassroomRoom {
  roomId: string;
  roomTitle: string;
  teacherId: string = '';
  teacherName: string = '';
  createdAt: number = Date.now();
  background: BoardBackgroundType = 'chalkboard-black';
  activePage: number = 1;
  totalPages: number = 3;
  elements: WhiteboardElement[] = [];
  undoStack: WhiteboardElement[][] = [];
  redoStack: WhiteboardElement[][] = [];
  studentsCanDraw: boolean = false;
  grantedStudentIds: Set<string> = new Set();
  chatMessages: ChatMessage[] = [];
  clients: Set<ClientSocket> = new Set();
  scrollX: number = 0;
  scrollY: number = 0;

  constructor(roomId: string, title?: string) {
    this.roomId = roomId;
    this.roomTitle = title || `Ders Odası #${roomId}`;
  }

  getUsers(): UserPresence[] {
    const list: UserPresence[] = [];
    for (const client of this.clients) {
      if (client.userData) {
        list.push({
          id: client.userData.id,
          name: client.userData.name,
          role: client.userData.role,
          color: client.userData.color,
          handRaised: client.userData.handRaised || false,
          hasFloor: this.grantedStudentIds.has(client.userData.id),
          lastSeen: Date.now(),
        });
      }
    }
    return list;
  }

  broadcast(message: Record<string, any>, excludeClient?: ClientSocket) {
    const payload = JSON.stringify(message);
    for (const client of this.clients) {
      if (client !== excludeClient && client.readyState === WebSocket.OPEN) {
        try {
          client.send(payload);
        } catch (err) {
          console.error('WebSocket send error:', err);
        }
      }
    }
  }

  getState(): RoomState {
    return {
      roomId: this.roomId,
      roomTitle: this.roomTitle,
      teacherId: this.teacherId,
      teacherName: this.teacherName,
      createdAt: this.createdAt,
      background: this.background,
      activePage: this.activePage,
      totalPages: this.totalPages,
      elements: this.elements,
      undoStack: [],
      redoStack: [],
      studentsCanDraw: this.studentsCanDraw,
      grantedStudentIds: Array.from(this.grantedStudentIds),
      chatMessages: this.chatMessages,
      activeUsers: this.getUsers(),
      scrollX: this.scrollX,
      scrollY: this.scrollY,
    };
  }
}

// In-memory room store
const rooms = new Map<string, ClassroomRoom>();

// Ensure a default room exists
const defaultRoom = new ClassroomRoom('GENEL-DERS', 'Genel Ders Tahtası');
rooms.set('GENEL-DERS', defaultRoom);

// WebSocket Server attached to HTTP server
const wss = new WebSocketServer({ server, path: '/ws' });

// Keep-alive heartbeat ping
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws: WebSocket) => {
    const client = ws as ClientSocket;
    if (client.isAlive === false) {
      return client.terminate();
    }
    client.isAlive = false;
    client.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

wss.on('connection', (ws: WebSocket) => {
  const client = ws as ClientSocket;
  client.isAlive = true;

  client.on('pong', () => {
    client.isAlive = true;
  });

  client.on('message', (data: Buffer | string) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'join') {
        const roomId = (msg.roomId || 'GENEL-DERS').toUpperCase().trim();
        let room = rooms.get(roomId);
        if (!room) {
          room = new ClassroomRoom(roomId, msg.roomTitle);
          rooms.set(roomId, room);
        }

        const requestedRole = msg.user?.role === 'teacher' ? 'teacher' : 'student';
        
        // If teacher doesn't exist yet in room or user is requesting teacher role
        if (!room.teacherId && requestedRole === 'teacher') {
          room.teacherId = msg.user.id;
          room.teacherName = msg.user.name;
        }

        const role = (room.teacherId === msg.user.id || requestedRole === 'teacher') ? 'teacher' : 'student';
        if (role === 'teacher') {
          room.teacherId = msg.user.id;
          room.teacherName = msg.user.name;
        }

        client.userData = {
          id: msg.user.id,
          name: msg.user.name,
          role,
          roomId,
          color: msg.user.color || '#3b82f6',
          handRaised: false,
        };

        room.clients.add(client);

        // Send full state to newly joined user
        client.send(JSON.stringify({
          type: 'init',
          state: room.getState(),
          you: client.userData,
        }));

        // Broadcast presence silently to others (no distracting notification banner)
        room.broadcast({
          type: 'users:update',
          users: room.getUsers(),
        });

        return;
      }

      // Check client has joined a room
      if (!client.userData || !client.userData.roomId) return;
      const { roomId } = client.userData;
      const room = rooms.get(roomId);
      if (!room) return;

      const userData = client.userData;
      const isTeacher = userData.role === 'teacher';
      const canDraw = isTeacher || room.studentsCanDraw || room.grantedStudentIds.has(userData.id);

      switch (msg.type) {
        case 'stroke:start': {
          if (!canDraw) return;
          room.broadcast({
            type: 'stroke:start',
            strokeId: msg.strokeId,
            element: msg.element,
          }, client);
          break;
        }

        case 'stroke:point': {
          if (!canDraw) return;
          room.broadcast({
            type: 'stroke:point',
            strokeId: msg.strokeId,
            point: msg.point,
          }, client);
          break;
        }

        case 'stroke:end': {
          if (!canDraw) return;
          if (msg.stroke && msg.stroke.id) {
            // Guard duplicate ID
            if (!room.elements.some(e => e.id === msg.stroke.id)) {
              // Push to undo stack
              room.undoStack.push([...room.elements]);
              if (room.undoStack.length > 50) room.undoStack.shift();
              room.redoStack = [];

              room.elements.push(msg.stroke);
            }
            room.broadcast({
              type: 'element:add',
              element: msg.stroke,
            }, client);
          }
          break;
        }

        case 'element:add': {
          if (!canDraw) return;
          if (msg.element && msg.element.id) {
            if (!room.elements.some(e => e.id === msg.element.id)) {
              room.undoStack.push([...room.elements]);
              if (room.undoStack.length > 50) room.undoStack.shift();
              room.redoStack = [];

              room.elements.push(msg.element);
            }
            room.broadcast({
              type: 'element:add',
              element: msg.element,
            }, client);
          }
          break;
        }

        case 'element:update': {
          if (!canDraw) return;
          const idx = room.elements.findIndex(e => e.id === msg.id);
          if (idx !== -1) {
            room.elements[idx] = { ...room.elements[idx], ...msg.patch };
            room.broadcast({
              type: 'element:update',
              id: msg.id,
              patch: msg.patch,
            }, client);
          }
          break;
        }

        case 'element:delete': {
          if (!canDraw) return;
          const initialLen = room.elements.length;
          room.elements = room.elements.filter(e => e.id !== msg.id);
          if (room.elements.length !== initialLen) {
            room.broadcast({
              type: 'element:delete',
              id: msg.id,
            });
          }
          break;
        }

        case 'board:clear': {
          // Only teacher can clear entire board, or student if drawing enabled
          if (!canDraw) return;
          const pageId = msg.pageId || room.activePage;
          room.undoStack.push([...room.elements]);
          room.redoStack = [];
          room.elements = room.elements.filter(e => e.pageId !== pageId);
          room.broadcast({
            type: 'board:clear',
            pageId,
            authorName: userData.name,
          });
          break;
        }

        case 'board:undo': {
          if (!canDraw) return;
          if (room.undoStack.length > 0) {
            const prev = room.undoStack.pop()!;
            room.redoStack.push([...room.elements]);
            room.elements = prev;
            room.broadcast({
              type: 'board:sync_elements',
              elements: room.elements,
            });
          }
          break;
        }

        case 'board:redo': {
          if (!canDraw) return;
          if (room.redoStack.length > 0) {
            const next = room.redoStack.pop()!;
            room.undoStack.push([...room.elements]);
            room.elements = next;
            room.broadcast({
              type: 'board:sync_elements',
              elements: room.elements,
            });
          }
          break;
        }

        case 'board:background': {
          // Teacher changes board background
          if (!isTeacher) return;
          if (msg.backgroundId) {
            room.background = msg.backgroundId;
            room.broadcast({
              type: 'board:background',
              backgroundId: msg.backgroundId,
              authorName: userData.name,
            });
          }
          break;
        }

        case 'board:scroll': {
          // Teacher viewport scroll synchronization for infinite 2D board
          if (!isTeacher) return;
          if (typeof msg.scrollY === 'number') {
            room.scrollY = Math.max(0, msg.scrollY);
          }
          if (typeof msg.scrollX === 'number') {
            room.scrollX = Math.max(0, msg.scrollX);
          }
          room.broadcast({
            type: 'board:scroll',
            scrollX: room.scrollX,
            scrollY: room.scrollY,
          }, client);
          break;
        }

        case 'board:page': {
          // Page switch
          if (!isTeacher) return;
          if (typeof msg.pageId === 'number') {
            room.activePage = Math.max(1, Math.min(msg.pageId, room.totalPages));
            room.scrollX = 0;
            room.scrollY = 0;
            if (msg.totalPages && msg.totalPages > room.totalPages) {
              room.totalPages = msg.totalPages;
            }
            room.broadcast({
              type: 'board:page',
              pageId: room.activePage,
              totalPages: room.totalPages,
              scrollX: 0,
              scrollY: 0,
            });
          }
          break;
        }

        case 'board:page_add': {
          if (!isTeacher) return;
          room.totalPages += 1;
          room.activePage = room.totalPages;
          room.scrollX = 0;
          room.scrollY = 0;
          room.broadcast({
            type: 'board:page',
            pageId: room.activePage,
            totalPages: room.totalPages,
            scrollX: 0,
            scrollY: 0,
          });
          break;
        }

        case 'board:page_delete': {
          if (!isTeacher || room.totalPages <= 1) return;
          const targetPage = typeof msg.pageId === 'number' ? msg.pageId : room.activePage;
          
          // Remove elements on deleted page and shift remaining pages down
          room.elements = room.elements
            .filter(e => e.pageId !== targetPage)
            .map(e => e.pageId > targetPage ? { ...e, pageId: e.pageId - 1 } : e);

          room.totalPages = Math.max(1, room.totalPages - 1);
          if (room.activePage > room.totalPages) {
            room.activePage = room.totalPages;
          } else if (room.activePage === targetPage) {
            room.activePage = Math.max(1, targetPage - 1);
          }

          room.broadcast({
            type: 'board:page_sync',
            pageId: room.activePage,
            totalPages: room.totalPages,
            elements: room.elements,
          });
          break;
        }

        case 'board:page_duplicate': {
          if (!isTeacher) return;
          const sourcePage = typeof msg.pageId === 'number' ? msg.pageId : room.activePage;
          room.totalPages += 1;
          const newPageId = room.totalPages;

          // Copy elements from source page to new page with unique IDs
          const copiedElements: WhiteboardElement[] = room.elements
            .filter(e => e.pageId === sourcePage)
            .map(e => ({
              ...e,
              id: 'elem_' + Math.random().toString(36).substring(2, 9),
              pageId: newPageId,
              createdAt: Date.now(),
            }));

          room.elements.push(...copiedElements);
          room.activePage = newPageId;

          room.broadcast({
            type: 'board:page_sync',
            pageId: room.activePage,
            totalPages: room.totalPages,
            elements: room.elements,
          });
          break;
        }

        case 'pointer:move': {
          // Live laser pointer or cursor movement
          room.broadcast({
            type: 'pointer:move',
            pointer: {
              userId: userData.id,
              userName: userData.name,
              userRole: userData.role,
              color: userData.color,
              x: msg.x,
              y: msg.y,
              pageId: room.activePage,
              active: msg.active !== false,
              lastActive: Date.now(),
            },
          }, client);
          break;
        }

        case 'permission:toggle_draw': {
          if (!isTeacher) return;
          room.studentsCanDraw = !!msg.enabled;
          room.broadcast({
            type: 'permission:update',
            studentsCanDraw: room.studentsCanDraw,
            grantedStudentIds: Array.from(room.grantedStudentIds),
          });
          break;
        }

        case 'permission:grant_student': {
          if (!isTeacher || !msg.studentId) return;
          room.grantedStudentIds.add(msg.studentId);
          for (const c of room.clients) {
            if (c.userData && c.userData.id === msg.studentId) {
              c.userData.handRaised = false;
            }
          }
          room.broadcast({
            type: 'permission:update',
            studentsCanDraw: room.studentsCanDraw,
            grantedStudentIds: Array.from(room.grantedStudentIds),
          });
          room.broadcast({
            type: 'users:update',
            users: room.getUsers(),
          });
          break;
        }

        case 'permission:revoke_student': {
          if (!isTeacher || !msg.studentId) return;
          room.grantedStudentIds.delete(msg.studentId);
          for (const c of room.clients) {
            if (c.userData && c.userData.id === msg.studentId) {
              c.userData.handRaised = false;
            }
          }
          room.broadcast({
            type: 'permission:update',
            studentsCanDraw: room.studentsCanDraw,
            grantedStudentIds: Array.from(room.grantedStudentIds),
          });
          room.broadcast({
            type: 'users:update',
            users: room.getUsers(),
          });
          break;
        }

        case 'user:hand': {
          // Student raises/lowers hand silently
          userData.handRaised = !!msg.raised;
          room.broadcast({
            type: 'users:update',
            users: room.getUsers(),
          });
          break;
        }

        case 'chat:send': {
          if (!msg.text || !msg.text.trim()) return;
          const chatMsg: ChatMessage = {
            id: 'chat_' + Math.random().toString(36).substring(2, 9),
            senderId: userData.id,
            senderName: userData.name,
            senderRole: userData.role,
            text: msg.text.trim(),
            timestamp: Date.now(),
            isQuestion: !!msg.isQuestion,
            isAnswered: false,
          };
          room.chatMessages.push(chatMsg);
          if (room.chatMessages.length > 200) room.chatMessages.shift();

          room.broadcast({
            type: 'chat:message',
            message: chatMsg,
          });
          break;
        }

        case 'chat:answer': {
          if (!isTeacher) return;
          const target = room.chatMessages.find(c => c.id === msg.messageId);
          if (target) {
            target.isAnswered = true;
            room.broadcast({
              type: 'chat:updated',
              messageId: target.id,
              isAnswered: true,
            });
          }
          break;
        }
      }
    } catch (err) {
      console.error('WebSocket message parsing error:', err);
    }
  });

  client.on('close', () => {
    if (client.userData && client.userData.roomId) {
      const room = rooms.get(client.userData.roomId);
      if (room) {
        room.clients.delete(client);
        // Clear laser pointer of this user
        room.broadcast({
          type: 'pointer:leave',
          userId: client.userData.id,
        });

        // Broadcast user list update silently
        room.broadcast({
          type: 'users:update',
          users: room.getUsers(),
        });
      }
    }
  });
});

// REST API Endpoints
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    activeRooms: rooms.size,
    totalConnections: wss.clients.size,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/rooms/:roomId', (req, res) => {
  const roomId = req.params.roomId.toUpperCase().trim();
  const room = rooms.get(roomId);
  if (!room) {
    return res.status(404).json({ error: 'Oda bulunamadı' });
  }
  res.json({
    roomId: room.roomId,
    roomTitle: room.roomTitle,
    teacherName: room.teacherName,
    activeUserCount: room.clients.size,
    background: room.background,
    activePage: room.activePage,
    totalPages: room.totalPages,
    studentsCanDraw: room.studentsCanDraw,
  });
});

// Serve frontend in production or hook up Vite middlewares in development
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[Canlı Ders Tahtası] Sunucu http://0.0.0.0:${PORT} adresinde çalışıyor`);
  });
}

startServer();
