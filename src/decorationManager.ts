import * as vscode from 'vscode';
import {TextEditorSelectionChangeEvent, window, DecorationOptions} from 'vscode';

export default class DecorationManager {
  decorations: DecorationOptions[] = [];
  decorationType = window.createTextEditorDecorationType({ after: { margin: '0 0 0 0.5rem' } });

  updateDecoration(decorations: DecorationOptions[], decoration: DecorationOptions) {
    const line = decoration.range.start.line;
    decorations = decorations.filter(dec => {
      return dec.range.start.line !== line;
    });
    decorations.push(decoration);
    return decorations;
  }
  renderWaitDecorations(e: TextEditorSelectionChangeEvent, lines: number[]) {
    const decorations = lines.map((line) => this.setDecorations(e, line, 'Waiting other execution...'));
    this.renderDecorations(e, decorations);
    return decorations;
  }
  setDecorations(e: TextEditorSelectionChangeEvent, line: number, text: string, type?: ('error' | 'info')) {
    let color = '#888';
    if (type === 'error') { color = '#F40'; }
    if (type === 'info') { color = '#79F'; }
    const decoration: DecorationOptions = {
      renderOptions: { after: { contentText: text, color } },
      range: new vscode.Range(new vscode.Position(line, 1024), new vscode.Position(line, 1024))
    };
    return decoration;
  }
  
  renderDecorations(e: TextEditorSelectionChangeEvent, decorations: DecorationOptions[]) {
    e.textEditor.setDecorations(this.decorationType, decorations);
  }
}