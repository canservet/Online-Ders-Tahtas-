import { useState, useEffect, useRef, useCallback } from 'react';
import type { 
  BoardBackgroundType, 
  WhiteboardElement, 
  ChatMessage, 
  UserPresence, 
  RoomState,
  LaserPointer,
  Point
} from '../types/whiteboard.ts';

interface UseWhiteboardSocketProps {
  roomId: string;
  userName: string;
  userRole: 'teacher' | 'student';
}

export function useWhiteboardSocket({ roomId, userName, userRole }: UseWhiteboardSocketProps) {
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [roomState, setRoomState] = useState<RoomState>({
    roomId,
    roomTitle: `Ders Odası #${roomId}`,
    teacherId: '',
    teacherName: '',
    createdAt: Date.now(),
    background: 'chalkboard-black',
    activePage: 1,
    totalPages: 3,
    elements: [],
    undoStack: [],
    redoStack: [],
    studentsCanDraw: false,
    grantedStudentIds: [],
    chatMessages: [],
    activeUsers: [],
  });

  const [userId] = useState<string>(() => {
    const saved = sessionStorage.getItem('wb_user_id');
    if (saved) return saved;
    const newId = 'u_' + Math.random().toString(36).substring(2, 9);
    sessionStorage.setItem('wb_user_id', newId);
    return newId;
  });

  const [userColor] = useState<string>(() => {
    const colors = ['#ffffff', '#e4e4e7', '#a1a1aa', '#71717a'];
    return colors[Math.floor(Math.random() * colors.length)];
  });

  const [remotePointers, setRemotePointers] = useState<Record<string, LaserPointer>>({});
  const [liveRemoteStrokes, setLiveRemoteStrokes] = useState<Record<string, Partial<WhiteboardElement>>>({});
  const [toastNotification] = useState<string | null>(null);
  const [remoteScroll, setRemoteScroll] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const isComponentMounted = useRef(true);

  // Notifications are silenced to avoid distracting the teacher and students
  const showToast = useCallback((_msg: string) => {}, []);

  const sendRaw = useCallback((data: Record<string, any>) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(data));
    }
  }, []);

  const connect = useCallback(() => {
    if (!isComponentMounted.current) return;
    setConnectionStatus('connecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        if (!isComponentMounted.current) return;
        setConnectionStatus('connected');
        // Join room immediately
        ws.send(JSON.stringify({
          type: 'join',
          roomId,
          user: {
            id: userId,
            name: userName,
            role: userRole,
            color: userColor,
          },
        }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          switch (msg.type) {
            case 'init': {
              setRoomState(msg.state);
              if (typeof msg.state?.scrollY === 'number' || typeof msg.state?.scrollX === 'number') {
                setRemoteScroll({
                  x: typeof msg.state?.scrollX === 'number' ? msg.state.scrollX : 0,
                  y: typeof msg.state?.scrollY === 'number' ? msg.state.scrollY : 0,
                });
              }
              break;
            }

            case 'users:update': {
              setRoomState(prev => ({
                ...prev,
                activeUsers: msg.users || prev.activeUsers,
              }));
              if (msg.notification) {
                showToast(msg.notification);
              }
              break;
            }

            case 'stroke:start': {
              if (msg.strokeId && msg.element) {
                setLiveRemoteStrokes(prev => ({
                  ...prev,
                  [msg.strokeId]: msg.element,
                }));
              }
              break;
            }

            case 'stroke:point': {
              if (msg.strokeId && msg.point) {
                setLiveRemoteStrokes(prev => {
                  const existing = prev[msg.strokeId];
                  if (!existing) return prev;
                  return {
                    ...prev,
                    [msg.strokeId]: {
                      ...existing,
                      points: [...(existing.points || []), msg.point],
                    },
                  };
                });
              }
              break;
            }

            case 'element:add': {
              if (msg.element) {
                setRoomState(prev => {
                  // Guard against duplicates
                  if (prev.elements.some(e => e.id === msg.element.id)) return prev;
                  return {
                    ...prev,
                    elements: [...prev.elements, msg.element],
                  };
                });
                // Remove from live in-flight strokes
                setLiveRemoteStrokes(prev => {
                  const next = { ...prev };
                  delete next[msg.element.id];
                  return next;
                });
              }
              break;
            }

            case 'element:update': {
              if (msg.id && msg.patch) {
                setRoomState(prev => ({
                  ...prev,
                  elements: prev.elements.map(e => e.id === msg.id ? { ...e, ...msg.patch } : e),
                }));
              }
              break;
            }

            case 'element:delete': {
              if (msg.id) {
                setRoomState(prev => ({
                  ...prev,
                  elements: prev.elements.filter(e => e.id !== msg.id),
                }));
              }
              break;
            }

            case 'board:clear': {
              const targetPage = msg.pageId;
              setRoomState(prev => ({
                ...prev,
                elements: prev.elements.filter(e => e.pageId !== targetPage),
              }));
              if (msg.authorName) {
                showToast(`${msg.authorName} tahtayı temizledi`);
              }
              break;
            }

            case 'board:sync_elements': {
              if (Array.isArray(msg.elements)) {
                setRoomState(prev => ({
                  ...prev,
                  elements: msg.elements,
                }));
              }
              break;
            }

            case 'board:background': {
              if (msg.backgroundId) {
                setRoomState(prev => ({
                  ...prev,
                  background: msg.backgroundId,
                }));
                if (msg.authorName) {
                  showToast(`Tahta arka planı değiştirildi`);
                }
              }
              break;
            }

            case 'board:scroll': {
              setRemoteScroll({
                x: typeof msg.scrollX === 'number' ? msg.scrollX : 0,
                y: typeof msg.scrollY === 'number' ? msg.scrollY : 0,
              });
              break;
            }

            case 'board:page': {
              setRoomState(prev => ({
                ...prev,
                activePage: msg.pageId,
                totalPages: msg.totalPages || prev.totalPages,
              }));
              setRemoteScroll({ x: 0, y: 0 });
              break;
            }

            case 'board:page_sync': {
              setRoomState(prev => ({
                ...prev,
                activePage: msg.pageId,
                totalPages: msg.totalPages,
                elements: msg.elements || prev.elements,
              }));
              if (msg.notification) {
                showToast(msg.notification);
              }
              break;
            }

            case 'pointer:move': {
              if (msg.pointer && msg.pointer.userId) {
                setRemotePointers(prev => ({
                  ...prev,
                  [msg.pointer.userId]: msg.pointer,
                }));
              }
              break;
            }

            case 'pointer:leave': {
              if (msg.userId) {
                setRemotePointers(prev => {
                  const next = { ...prev };
                  delete next[msg.userId];
                  return next;
                });
              }
              break;
            }

            case 'permission:update': {
              setRoomState(prev => ({
                ...prev,
                studentsCanDraw: !!msg.studentsCanDraw,
                grantedStudentIds: Array.isArray(msg.grantedStudentIds) ? msg.grantedStudentIds : prev.grantedStudentIds,
              }));
              if (msg.notification) {
                showToast(msg.notification);
              }
              break;
            }

            case 'chat:message': {
              if (msg.message) {
                setRoomState(prev => ({
                  ...prev,
                  chatMessages: [...prev.chatMessages, msg.message],
                }));
              }
              break;
            }

            case 'chat:updated': {
              if (msg.messageId) {
                setRoomState(prev => ({
                  ...prev,
                  chatMessages: prev.chatMessages.map(m => 
                    m.id === msg.messageId ? { ...m, isAnswered: msg.isAnswered } : m
                  ),
                }));
              }
              break;
            }
          }
        } catch (e) {
          console.error('Error handling socket message:', e);
        }
      };

      ws.onclose = () => {
        if (!isComponentMounted.current) return;
        setConnectionStatus('disconnected');
        // Auto-reconnect after 2 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 2000);
      };

      ws.onerror = (err) => {
        console.warn('WebSocket connection issue:', err);
        ws.close();
      };
    } catch (e) {
      console.error('Failed to create WebSocket:', e);
      setConnectionStatus('disconnected');
    }
  }, [roomId, userId, userName, userRole, userColor, showToast]);

  useEffect(() => {
    isComponentMounted.current = true;
    connect();

    return () => {
      isComponentMounted.current = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect]);

  // Outgoing actions
  const sendStrokeStart = useCallback((strokeId: string, element: Partial<WhiteboardElement>) => {
    sendRaw({
      type: 'stroke:start',
      strokeId,
      element,
    });
  }, [sendRaw]);

  const sendStrokePoint = useCallback((strokeId: string, point: Point) => {
    sendRaw({
      type: 'stroke:point',
      strokeId,
      point,
    });
  }, [sendRaw]);

  const sendStrokeEnd = useCallback((stroke: WhiteboardElement) => {
    // Optimistic local update
    setRoomState(prev => {
      if (prev.elements.some(e => e.id === stroke.id)) return prev;
      return {
        ...prev,
        elements: [...prev.elements, stroke],
      };
    });
    sendRaw({
      type: 'stroke:end',
      stroke,
    });
  }, [sendRaw]);

  const addElement = useCallback((element: WhiteboardElement) => {
    setRoomState(prev => {
      if (prev.elements.some(e => e.id === element.id)) return prev;
      return {
        ...prev,
        elements: [...prev.elements, element],
      };
    });
    sendRaw({
      type: 'element:add',
      element,
    });
  }, [sendRaw]);

  const updateElement = useCallback((id: string, patch: Partial<WhiteboardElement>) => {
    setRoomState(prev => ({
      ...prev,
      elements: prev.elements.map(e => e.id === id ? { ...e, ...patch } : e),
    }));
    sendRaw({
      type: 'element:update',
      id,
      patch,
    });
  }, [sendRaw]);

  const deleteElement = useCallback((id: string) => {
    setRoomState(prev => ({
      ...prev,
      elements: prev.elements.filter(e => e.id !== id),
    }));
    sendRaw({
      type: 'element:delete',
      id,
    });
  }, [sendRaw]);

  const clearBoard = useCallback((pageId: number) => {
    setRoomState(prev => ({
      ...prev,
      elements: prev.elements.filter(e => e.pageId !== pageId),
    }));
    sendRaw({
      type: 'board:clear',
      pageId,
    });
  }, [sendRaw]);

  const setBackground = useCallback((backgroundId: BoardBackgroundType) => {
    setRoomState(prev => ({
      ...prev,
      background: backgroundId,
    }));
    sendRaw({
      type: 'board:background',
      backgroundId,
    });
  }, [sendRaw]);

  const setPage = useCallback((pageId: number, totalPages?: number) => {
    setRoomState(prev => ({
      ...prev,
      activePage: pageId,
      totalPages: totalPages || prev.totalPages,
    }));
    sendRaw({
      type: 'board:page',
      pageId,
      totalPages,
    });
  }, [sendRaw]);

  const addPage = useCallback(() => {
    sendRaw({
      type: 'board:page_add',
    });
  }, [sendRaw]);

  const deletePage = useCallback((pageId: number) => {
    sendRaw({
      type: 'board:page_delete',
      pageId,
    });
  }, [sendRaw]);

  const duplicatePage = useCallback((pageId: number) => {
    sendRaw({
      type: 'board:page_duplicate',
      pageId,
    });
  }, [sendRaw]);

  const sendPointerMove = useCallback((x: number, y: number, active: boolean) => {
    sendRaw({
      type: 'pointer:move',
      x,
      y,
      active,
    });
  }, [sendRaw]);

  const toggleStudentDraw = useCallback((enabled: boolean) => {
    setRoomState(prev => ({
      ...prev,
      studentsCanDraw: enabled,
    }));
    sendRaw({
      type: 'permission:toggle_draw',
      enabled,
    });
  }, [sendRaw]);

  const grantStudentDraw = useCallback((studentId: string) => {
    setRoomState(prev => ({
      ...prev,
      grantedStudentIds: Array.from(new Set([...(prev.grantedStudentIds || []), studentId])),
    }));
    sendRaw({
      type: 'permission:grant_student',
      studentId,
    });
  }, [sendRaw]);

  const revokeStudentDraw = useCallback((studentId: string) => {
    setRoomState(prev => ({
      ...prev,
      grantedStudentIds: (prev.grantedStudentIds || []).filter(id => id !== studentId),
    }));
    sendRaw({
      type: 'permission:revoke_student',
      studentId,
    });
  }, [sendRaw]);

  const raiseHand = useCallback((raised: boolean) => {
    sendRaw({
      type: 'user:hand',
      raised,
    });
  }, [sendRaw]);

  const sendChatMessage = useCallback((text: string, isQuestion: boolean = false) => {
    sendRaw({
      type: 'chat:send',
      text,
      isQuestion,
    });
  }, [sendRaw]);

  const markQuestionAnswered = useCallback((messageId: string) => {
    setRoomState(prev => ({
      ...prev,
      chatMessages: prev.chatMessages.map(m => m.id === messageId ? { ...m, isAnswered: true } : m),
    }));
    sendRaw({
      type: 'chat:answer',
      messageId,
    });
  }, [sendRaw]);

  const undo = useCallback(() => {
    sendRaw({ type: 'board:undo' });
  }, [sendRaw]);

  const redo = useCallback(() => {
    sendRaw({ type: 'board:redo' });
  }, [sendRaw]);

  const sendScroll = useCallback((scrollX: number, scrollY: number) => {
    sendRaw({
      type: 'board:scroll',
      scrollX: Math.max(0, scrollX),
      scrollY: Math.max(0, scrollY),
    });
  }, [sendRaw]);

  return {
    userId,
    userColor,
    connectionStatus,
    roomState,
    remotePointers,
    liveRemoteStrokes,
    toastNotification,
    remoteScroll,
    remoteScrollY: remoteScroll.y,
    sendScroll,
    showToast,
    sendStrokeStart,
    sendStrokePoint,
    sendStrokeEnd,
    addElement,
    updateElement,
    deleteElement,
    clearBoard,
    setBackground,
    setPage,
    addPage,
    deletePage,
    duplicatePage,
    sendPointerMove,
    toggleStudentDraw,
    grantStudentDraw,
    revokeStudentDraw,
    raiseHand,
    sendChatMessage,
    markQuestionAnswered,
    undo,
    redo,
  };
}
