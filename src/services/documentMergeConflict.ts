import * as interfaces from './interfaces';
import * as vscode from 'vscode';

export class DocumentMergeConflict implements interfaces.IDocumentMergeConflict {

    public range: vscode.Range;
    public current: interfaces.IMergeRegion;
    public incoming: interfaces.IMergeRegion;
    public splitter: vscode.Range;

    constructor(document: vscode.TextDocument, match: RegExpExecArray, offsets?: number[]) {
        this.range = new vscode.Range(document.positionAt(match.index), document.positionAt(match.index + match[0].length));

        this.current = {
            name: match[2],
            header: this.getMatchPositions(document, match, 1, offsets),
            content: this.getMatchPositions(document, match, 3, offsets),
        };

        this.splitter = this.getMatchPositions(document, match, 5, offsets);

        this.incoming = {
            name: match[9],
            header: this.getMatchPositions(document, match, 8, offsets),
            content: this.getMatchPositions(document, match, 6, offsets),
        };

    }

    public commitEdit(type: interfaces.CommitType, editor: vscode.TextEditor, edit?: vscode.TextEditorEdit): Thenable<boolean> {

        if (edit) {

            this.applyEdit(type, editor, edit);
            return Promise.resolve(true);
        };

        return editor.edit((edit) => this.applyEdit(type, editor, edit));
    }

    public applyEdit(type: interfaces.CommitType, editor: vscode.TextEditor, edit: vscode.TextEditorEdit) : void {
        if (type === interfaces.CommitType.Current) {
            edit.replace(this.range, editor.document.getText(this.current.content));
        }
        else if (type === interfaces.CommitType.Incoming) {
            edit.replace(this.range, editor.document.getText(this.incoming.content));
        }
    }

    private getMatchPositions(document: vscode.TextDocument, match: RegExpExecArray, groupIndex: number, offsetGroups?: number[]): vscode.Range {
        // Javascript doesnt give of offsets within the match, we need to calculate these
        // based of the prior groups, skipping nested matches (yuck).
        if (!offsetGroups) {
            offsetGroups = match.map((i, idx) => idx);
        }

        let start = match.index;

        for (var i = 0; i < offsetGroups.length; i++) {
            let value = offsetGroups[i];

            if (value >= groupIndex) {
                break;
            }

            start += match[value].length;
        }

        let targetMatchLength = match[groupIndex].length;
        let end = (start + targetMatchLength);

        // Move the end up if it's capped by a trailing \r\n, this is so regions don't expand into
        // the line below, and can be "pulled down" by editing the line below
        if (match[groupIndex].lastIndexOf('\n') === targetMatchLength - 1) {
            end--;

            // .. for windows encodings of new lines
            if (match[groupIndex].lastIndexOf('\r') === targetMatchLength - 2) {
                end--;
            }
        }

        return new vscode.Range(document.positionAt(start), document.positionAt(end));
    }
}