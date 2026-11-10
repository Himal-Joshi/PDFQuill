export type EditorToolMode =
  | 'select'
  | 'text'
  | 'image'
  | 'draw'
  | 'shape'
  | 'signature'
  | 'stamp-check'
  | 'stamp-cross'
  | 'stamp-date';

export type FontChoice = 'Helvetica' | 'TimesRoman' | 'Courier';

export type ShapeType = 'rectangle' | 'circle' | 'line';

export interface BaseElement {
  id: string;
  pageIndex: number;
  x: number;       // relative to canvas in canonical PDF points
  y: number;       // relative to canvas in canonical PDF points
  width: number;   // in canonical PDF points
  height: number;  // in canonical PDF points
  rotation?: number;
  opacity?: number;
}

export interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  fontFamily: FontChoice;
  fontSize: number; // in points
  color: string;    // hex color
  backgroundColor?: string; // e.g. 'transparent', '#ffffff', '#fef08a'
  align?: 'left' | 'center' | 'right';
  bold: boolean;
  italic: boolean;
  underline?: boolean;
}

export interface ImageElement extends BaseElement {
  type: 'image' | 'signature';
  dataUrl: string;       // base64 data URL
  aspectRatio: number;   // width / height
  isSignature?: boolean;
  rotation?: number;
}

export interface StampElement extends BaseElement {
  type: 'stamp';
  stampType: 'check' | 'cross' | 'date';
  textValue?: string;
  color: string;
  fontSize: number;
}

export interface ShapeElement extends BaseElement {
  type: 'shape';
  shapeType: ShapeType;
  fillColor: string;     // 'transparent' | hex
  strokeColor: string;   // 'transparent' | hex
  strokeWidth: number;   // in points
}

export interface DrawingElement extends BaseElement {
  type: 'drawing';
  color: string;         // hex
  strokeWidth: number;
  points: { x: number; y: number }[];
  isHighlighter?: boolean;
}

export type EditorElement = TextElement | ImageElement | StampElement | ShapeElement | DrawingElement;

export interface EditorHistoryState {
  past: EditorElement[][];
  present: EditorElement[];
  future: EditorElement[][];
}
