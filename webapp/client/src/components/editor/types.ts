export type EditorToolMode = 'select' | 'text' | 'signature' | 'stamp-check' | 'stamp-cross' | 'stamp-date';

export type FontChoice = 'Helvetica' | 'TimesRoman' | 'Courier';

export interface BaseElement {
  id: string;
  pageIndex: number;
  x: number;       // relative to canvas in px
  y: number;       // relative to canvas in px
  width: number;   // in px
  height: number;  // in px
  rotation?: number;
}

export interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  fontFamily: FontChoice;
  fontSize: number; // in points
  color: string;    // hex color
  bold: boolean;
  italic: boolean;
}

export interface ImageElement extends BaseElement {
  type: 'image' | 'signature';
  dataUrl: string;       // base64 data URL
  aspectRatio: number;   // width / height
  isSignature?: boolean;
}

export interface StampElement extends BaseElement {
  type: 'stamp';
  stampType: 'check' | 'cross' | 'date';
  textValue?: string;
  color: string;
  fontSize: number;
}

export type EditorElement = TextElement | ImageElement | StampElement;

export interface EditorHistoryState {
  past: EditorElement[][];
  present: EditorElement[];
  future: EditorElement[][];
}
