import * as vscode from 'vscode';
import { TextEditorSelectionChangeEvent } from 'vscode';
import { spawn, ChildProcess } from "child_process";
import 'colors';
import * as PromiseB from 'bluebird';
import DecorationManager from './decorationManager';
import * as debounce from 'debounce';
const marker = '//.?';
let node: ChildProcess;
let previousCode = '';
const decorationsManager = new DecorationManager();

var debounced = debounce(checkChanges, 500, false);

export function activate(context: vscode.ExtensionContext) {
	vscode.window.onDidChangeTextEditorSelection(debounced);
}
function checkChanges(e: TextEditorSelectionChangeEvent) {
	const code = e.textEditor.document.getText();
		if(code === previousCode) { return; }
		else { previousCode = code;}
		if (node) { node.kill('SIGKILL'); }
		const lines = getMarker(code, marker);
		const decorations = decorationsManager.renderWaitDecorations(e, lines);
		launchBench(e, code, decorations);
}

async function launchBench(e: TextEditorSelectionChangeEvent, code: string, decorations: vscode.DecorationOptions[]) {
	const linesExecutions = getExecuteCodeForEachLines(decorations, code, marker);
	await PromiseB.map(linesExecutions, async line => {
		decorations = decorationsManager.updateDecoration(decorations, decorationsManager.setDecorations(e, line.line, 'Execute...', 'info'));
		decorationsManager.renderDecorations(e, decorations);
		const decoration = await executeCode(e, line);
		decorations = decorationsManager.updateDecoration(decorations, decoration);
		decorationsManager.renderDecorations(e, decorations);
	}, { concurrency: 1 });
}


function getMarker(code: string, marker: string) {
	return code
		.split('\n')
		.map((line, i) => line.includes(marker) && line.substring(0,2) !== '//' ? i : -1)
		.filter(a => a !== -1);
}
async function executeCode(e: TextEditorSelectionChangeEvent, decoration: { line: number; execute: string; decoration: vscode.DecorationOptions }) {
	const { stdout, stderr } = await bash(e.textEditor.document.fileName, decoration.execute);
	if (stderr) {
		return decorationsManager.setDecorations(e, decoration.line, stderr, 'error');
	} else {
		const regex = /###result: (.*[^]*)###time/.exec(stdout || '');
		let result = regex ? regex[1] : '';
		let time = (stdout || '').split('\n').filter((s: string) => s.includes('###time:')).pop() || '';
		result = result.split('\n').join('  ');
		time = time.split('###time: ').pop() || '';
		const text = time + ' - ' + result.split('\n').join('    ');
		return decorationsManager.setDecorations(e, decoration.line, text);
	}
}
function getExecuteCodeForEachLines(decorations: vscode.DecorationOptions[], code: string, marker: string) {
	return decorations.map((decoration) => {
		const splitted = code.split('\n');
		const timeTag = `###time`;
		const resultTag = `###result:`;
		const line = decoration.range.start.line;
		splitted[line] = `console.time("${timeTag}");console.log("${resultTag}", ` + splitted[line || 0].replace(';', '').replace(marker, '') + `); console.timeEnd("${timeTag}"); //`;
		return {
			line,
			execute: splitted.join('\n'),
			decoration
		};
	});
}
function bash(fileName: string, file: string): Promise<{ stdout: string | null, stderr: string | null }> {
	const filePath = fileName.split('/');
	filePath.pop();
	node = spawn('node', { cwd: filePath.join('/') });
	return new Promise((resolve, reject) => {
		let stdout = '';
		let stderr = '';
		node.stdout.on('data', data => {
			stdout += data.toString('utf-8');
		});
		node.stderr.on('data', data => {
			stderr += data
				.toString('utf-8')
				.split('\n')
				.splice(3)
				.join('   ');
		});
		node.stdout.on('end', () => {
			resolve({
				stderr,
				stdout: stderr ? null : stdout
			});
		});
		node.stdin.end(file);
	});
}


// this method is called when your extension is deactivated
export function deactivate() { }

