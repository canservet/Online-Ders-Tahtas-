export type BoardBackgroundType = 
  | 'chalkboard-black' 
  | 'whiteboard-clean' 
  | 'grid-black' 
  | 'grid-white' 
  | 'lined-black' 
  | 'lined-white' 
  | 'dots-black' 
  | 'dots-white'
  | 'chalkboard-green'
  | 'notebook-grid'
  | 'notebook-lined'
  | 'dark-studio'
  | 'blueprint'
  | 'isometric';

export interface BackgroundConfig {
  id: BoardBackgroundType;
  name: string;
  category: 'Siyah Tahta' | 'Beyaz Tahta';
  description: string;
  bgColor: string;
  lineColor: string;
  pattern: 'none' | 'grid' | 'lined' | 'dots' | 'isometric';
  gridSize: number;
  textColor: string;
  defaultStrokeColor: string;
  chalkEffect: boolean;
}

export const BOARD_BACKGROUNDS: Record<string, BackgroundConfig> = {
  'chalkboard-black': {
    id: 'chalkboard-black',
    name: 'Düz Siyah Tahta',
    category: 'Siyah Tahta',
    description: 'Sıfır dikkat dağıtıcı, derin mat siyah zemin',
    bgColor: '#000000',
    lineColor: 'rgba(255,255,255,0.12)',
    pattern: 'none',
    gridSize: 36,
    textColor: '#ffffff',
    defaultStrokeColor: '#ffffff',
    chalkEffect: true,
  },
  'whiteboard-clean': {
    id: 'whiteboard-clean',
    name: 'Düz Beyaz Tahta',
    category: 'Beyaz Tahta',
    description: 'Yüksek kontrast, pürüzsüz beyaz ders tahtası',
    bgColor: '#ffffff',
    lineColor: 'rgba(0,0,0,0.12)',
    pattern: 'none',
    gridSize: 36,
    textColor: '#000000',
    defaultStrokeColor: '#000000',
    chalkEffect: false,
  },
  'grid-black': {
    id: 'grid-black',
    name: 'Kareli Siyah Tahta',
    category: 'Siyah Tahta',
    description: 'Matematik ve çizimler için siyah zemin üzerine ince gri kareler',
    bgColor: '#050505',
    lineColor: 'rgba(255,255,255,0.10)',
    pattern: 'grid',
    gridSize: 32,
    textColor: '#ffffff',
    defaultStrokeColor: '#ffffff',
    chalkEffect: false,
  },
  'grid-white': {
    id: 'grid-white',
    name: 'Kareli Beyaz Tahta',
    category: 'Beyaz Tahta',
    description: 'Matematik ve fen dersleri için beyaz zemin üzerine ince gri kareler',
    bgColor: '#ffffff',
    lineColor: 'rgba(0,0,0,0.08)',
    pattern: 'grid',
    gridSize: 32,
    textColor: '#000000',
    defaultStrokeColor: '#000000',
    chalkEffect: false,
  },
  'lined-black': {
    id: 'lined-black',
    name: 'Çizgili Siyah Tahta',
    category: 'Siyah Tahta',
    description: 'Yazı ve notlar için siyah zemin üzerine yatay çizgiler',
    bgColor: '#050505',
    lineColor: 'rgba(255,255,255,0.12)',
    pattern: 'lined',
    gridSize: 36,
    textColor: '#ffffff',
    defaultStrokeColor: '#ffffff',
    chalkEffect: false,
  },
  'lined-white': {
    id: 'lined-white',
    name: 'Çizgili Beyaz Tahta',
    category: 'Beyaz Tahta',
    description: 'Yazı ve konu anlatımı için beyaz zemin üzerine yatay çizgiler',
    bgColor: '#ffffff',
    lineColor: 'rgba(0,0,0,0.10)',
    pattern: 'lined',
    gridSize: 36,
    textColor: '#000000',
    defaultStrokeColor: '#000000',
    chalkEffect: false,
  },
  'dots-black': {
    id: 'dots-black',
    name: 'Noktalı Siyah Tahta',
    category: 'Siyah Tahta',
    description: 'Gözü yormayan minimal noktalı mat siyah ders tahtası',
    bgColor: '#000000',
    lineColor: 'rgba(255,255,255,0.18)',
    pattern: 'dots',
    gridSize: 32,
    textColor: '#ffffff',
    defaultStrokeColor: '#ffffff',
    chalkEffect: false,
  },
  'dots-white': {
    id: 'dots-white',
    name: 'Noktalı Beyaz Tahta',
    category: 'Beyaz Tahta',
    description: 'Minimal ve sade noktalı beyaz ders tahtası',
    bgColor: '#ffffff',
    lineColor: 'rgba(0,0,0,0.15)',
    pattern: 'dots',
    gridSize: 32,
    textColor: '#000000',
    defaultStrokeColor: '#000000',
    chalkEffect: false,
  },
  // Backward compatibility aliases
  'chalkboard-green': {
    id: 'chalkboard-black',
    name: 'Düz Siyah Tahta',
    category: 'Siyah Tahta',
    description: 'Derin mat siyah zemin',
    bgColor: '#000000',
    lineColor: 'rgba(255,255,255,0.12)',
    pattern: 'none',
    gridSize: 36,
    textColor: '#ffffff',
    defaultStrokeColor: '#ffffff',
    chalkEffect: true,
  },
  'notebook-grid': {
    id: 'grid-white',
    name: 'Kareli Beyaz Tahta',
    category: 'Beyaz Tahta',
    description: 'Kareli beyaz ders tahtası',
    bgColor: '#ffffff',
    lineColor: 'rgba(0,0,0,0.08)',
    pattern: 'grid',
    gridSize: 32,
    textColor: '#000000',
    defaultStrokeColor: '#000000',
    chalkEffect: false,
  },
  'notebook-lined': {
    id: 'lined-white',
    name: 'Çizgili Beyaz Tahta',
    category: 'Beyaz Tahta',
    description: 'Çizgili beyaz ders tahtası',
    bgColor: '#ffffff',
    lineColor: 'rgba(0,0,0,0.10)',
    pattern: 'lined',
    gridSize: 36,
    textColor: '#000000',
    defaultStrokeColor: '#000000',
    chalkEffect: false,
  },
  'dark-studio': {
    id: 'dots-black',
    name: 'Noktalı Siyah Tahta',
    category: 'Siyah Tahta',
    description: 'Minimal noktalı siyah zemin',
    bgColor: '#000000',
    lineColor: 'rgba(255,255,255,0.18)',
    pattern: 'dots',
    gridSize: 32,
    textColor: '#ffffff',
    defaultStrokeColor: '#ffffff',
    chalkEffect: false,
  },
  'blueprint': {
    id: 'grid-black',
    name: 'Kareli Siyah Tahta',
    category: 'Siyah Tahta',
    description: 'Kareli siyah tahta',
    bgColor: '#050505',
    lineColor: 'rgba(255,255,255,0.10)',
    pattern: 'grid',
    gridSize: 32,
    textColor: '#ffffff',
    defaultStrokeColor: '#ffffff',
    chalkEffect: false,
  },
  'isometric': {
    id: 'dots-white',
    name: 'Noktalı Beyaz Tahta',
    category: 'Beyaz Tahta',
    description: 'Noktalı beyaz tahta',
    bgColor: '#ffffff',
    lineColor: 'rgba(0,0,0,0.15)',
    pattern: 'dots',
    gridSize: 32,
    textColor: '#000000',
    defaultStrokeColor: '#000000',
    chalkEffect: false,
  },
};

export type ToolType = 
  | 'select' 
  | 'pen' 
  | 'highlighter' 
  | 'chalk'
  | 'laser' 
  | 'eraser' 
  | 'pan'
  | 'line' 
  | 'arrow' 
  | 'rect' 
  | 'circle' 
  | 'triangle' 
  | 'axes' 
  | 'text' 
  | 'sticky' 
  | 'math';

export interface Point {
  x: number;
  y: number;
  pressure?: number;
}

export interface WhiteboardElement {
  id: string;
  pageId: number;
  type: ToolType;
  points?: Point[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  color: string;
  strokeWidth: number;
  fillColor?: string;
  text?: string;
  fontSize?: number;
  isFilled?: boolean;
  authorId: string;
  authorName: string;
  authorRole: 'teacher' | 'student';
  createdAt: number;
}

export interface LaserPointer {
  userId: string;
  userName: string;
  userRole: 'teacher' | 'student';
  color: string;
  x: number;
  y: number;
  pageId: number;
  active: boolean;
  lastActive: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'teacher' | 'student';
  text: string;
  timestamp: number;
  isQuestion?: boolean;
  isAnswered?: boolean;
}

export interface UserPresence {
  id: string;
  name: string;
  role: 'teacher' | 'student';
  color: string;
  handRaised: boolean;
  hasFloor?: boolean;
  cursor?: { x: number; y: number };
  lastSeen: number;
}

export interface RoomState {
  roomId: string;
  roomTitle: string;
  teacherId: string;
  teacherName: string;
  createdAt: number;
  background: BoardBackgroundType;
  activePage: number;
  totalPages: number;
  elements: WhiteboardElement[];
  undoStack: WhiteboardElement[][];
  redoStack: WhiteboardElement[][];
  studentsCanDraw: boolean;
  grantedStudentIds?: string[];
  chatMessages: ChatMessage[];
  activeUsers: UserPresence[];
  scrollX?: number;
  scrollY?: number;
}
