/*******************************************************************************
 * Copyright (c) 2011 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
 *******************************************************************************/
/*global define window orion:true */
/*jslint maxerr:150 browser:true devel:true regexp:false*/


/**
 * @namespace The container for Orion APIs.
 */ 
var orion = orion || {};
orion.editor = orion.editor || {};	

orion.editor.UndoFactory = (function() {
	function UndoFactory() {
	}
	UndoFactory.prototype = {
		createUndoStack: function(editor) {
			var undoStack =  new orion.textview.UndoStack(editor.getTextView(), 200);
			editor.getTextView().setKeyBinding(new orion.textview.KeyBinding('z', true), "Undo");
			editor.getTextView().setAction("Undo", function() {
				undoStack.undo();
				return true;
			});
			
			var isMac = navigator.platform.indexOf("Mac") !== -1;
			editor.getTextView().setKeyBinding(isMac ? new orion.textview.KeyBinding('z', true, true) : new orion.textview.KeyBinding('y', true), "Redo");
			editor.getTextView().setAction("Redo", function() {
				undoStack.redo();
				return true;
			});
			return undoStack;
		}
	};
	return UndoFactory;
}());

orion.editor.LineNumberRulerFactory = (function() {
	function LineNumberRulerFactory() {
	}
	LineNumberRulerFactory.prototype = {
		createLineNumberRuler: function() {
			return new orion.textview.LineNumberRuler("left", {styleClass: "lineNumberRuler"}, {styleClass: "lineNumberRuler-odd"}, {styleClass: "lineNumberRuler-even"});
		}
	};
	return LineNumberRulerFactory;
}());


orion.editor.AnnotationFactory = (function() {
	function AnnotationFactory(problemImageUrl) {
		this.problemImageUrl = problemImageUrl;
	}
	AnnotationFactory.prototype = {
		createAnnotationRulers: function() {
			this.annotationRuler = new orion.textview.AnnotationRuler("left", {styleClass: "annotationRuler"}, {html: "<img src='" + this.problemImageUrl + "'></img>"});
			this.overviewRuler = new orion.textview.OverviewRuler("right", {styleClass: "overviewRuler"}, this.annotationRuler);
			return {annotationRuler: this.annotationRuler, overviewRuler: this.overviewRuler};
		},
		
		showProblems : function(problems) {
			var errors, i, k, escapedReason, functions;
			errors = problems || [];
			i = 0;
			if (errors.length>0 && errors[errors.length - 1] === null) {
				errors.pop();
			}
			var ruler = this.annotationRuler;
			if (!ruler) {
				return;
			}
			ruler.clearAnnotations();
			var lastLine = -1;
			for (k in errors) {
				if (errors[k]) {
					// escaping voodoo... we need to construct HTML that contains valid JavaScript.
					escapedReason = errors[k].reason.replace(/'/g, "&#39;").replace(/"/g, '&#34;');
					// console.log(escapedReason);
					var annotation = {
						line: errors[k].line - 1,
						column: errors[k].character,
						html: "<img src='" + this.problemImageUrl + "' title='" + escapedReason + "' alt='" + escapedReason + "'></img>",
						overviewStyle: {style: {"backgroundColor": "lightcoral", "border": "1px solid red"}}
					};
					
					// only one error reported per line, unless we want to merge them.  
					// For now, just show the first one, and the next one will show when the first is fixed...
					if (lastLine !== errors[k].line) {
						// console.log("adding annotation at line " + errors[k].line);
						ruler.setAnnotation(errors[k].line - 1, annotation);
						lastLine = errors[k].line;
					}
				}
			}
		}
	};
	return AnnotationFactory;
}());

/**
 * TextCommands connects common text editing keybindings onto an editor.
 */
orion.editor.TextActions = (function() {
	function TextActions(editor, undoStack, searcher) {
		this.editor = editor;
		this.textView = editor.getTextView();
		this.undoStack = undoStack;
		this._incrementalFindActive = false;
		this._incrementalFindSuccess = true;
		this._incrementalFindIgnoreSelection = false;
		this._incrementalFindPrefix = "";
		this._searcher =  searcher;
		if(this._searcher)
			this._searcher.getAdaptor().setEditor(this.editor, this.textView);

		this.init();
	}
	TextActions.prototype = {
		init: function() {
			this._incrementalFindListener = {
				onVerify: function(event){
					/** @returns {String} with regex special characters escaped. */
					function regexpEscape(/**String*/ str) {
						return str.replace(/([\\$\^*\/+?\.\(\)|{}\[\]])/g, "\\$&");
					}
					var prefix = this._incrementalFindPrefix,
						txt = this.textView.getText(event.start, event.end),
						match = prefix.match(new RegExp("^"+regexpEscape(txt), "i"));
					if (match && match.length > 0) {
						prefix = this._incrementalFindPrefix += event.text;
						this.editor.reportStatus("Incremental find: " + prefix);
						var ignoreCase = prefix.toLowerCase() === prefix;
						var result = this.editor.doFind(prefix, this.textView.getSelection().start, ignoreCase);
						if (result) {
							this._incrementalFindSuccess = true;
							this._incrementalFindIgnoreSelection = true;
							this.editor.moveSelection(this.textView, result.index, result.index+result.length);
							this._incrementalFindIgnoreSelection = false;
						} else {
							this.editor.reportStatus("Incremental find: " + prefix + " (not found)", true);
							this._incrementalFindSuccess = false;
						}
						event.text = null;
					} else {
					}
				}.bind(this),
				onSelection: function() {
					if (!this._incrementalFindIgnoreSelection) {
						this.toggleIncrementalFind();
					}
				}.bind(this)
			};
			// Find actions
			// These variables are used among the various find actions:
			this.textView.setKeyBinding(new orion.textview.KeyBinding("f", true), "Find...");
			this.textView.setAction("Find...", function() {
				if(!this._searcher)
					return false;
				var selection = this.textView.getSelection();
				var searchString = "";
				if (selection.end > selection.start) {
					searchString = this.textView.getText().substring(selection.start, selection.end);
				}
				this._searcher.buildToolBar(searchString);
				return true;
			}.bind(this));
			
			this.textView.setKeyBinding(new orion.textview.KeyBinding("k", true), "Find Next Occurrence");
			this.textView.setAction("Find Next Occurrence", function() {
				if(this._searcher){
					this._searcher.findNext(true);
				}
				return true;
			}.bind(this));
			
			this.textView.setKeyBinding(new orion.textview.KeyBinding("k", true, true), "Find Previous Occurrence");
			this.textView.setAction("Find Previous Occurrence", function() {
				if(this._searcher){
					this._searcher.findNext(false);
				}
				return true;
			}.bind(this));

			this.textView.setKeyBinding(new orion.textview.KeyBinding("j", true), "Incremental Find");
			this.textView.setAction("Incremental Find", function() {
				if(this._searcher && this._searcher.visible())
					return true;
				if (!this._incrementalFindActive) {
					this.textView.setCaretOffset(this.textView.getCaretOffset());
					this.toggleIncrementalFind();
				} else {
					var p = this._incrementalFindPrefix;
					if (p.length !== 0) {
						var start = this.textView.getSelection().start + 1;
						if (this._incrementalFindSuccess === false) {
							start = 0;
						}
						
						var caseInsensitive = p.toLowerCase() === p;
						var result;
						if(this._searcher)
							result = _searcher.findNext(true, p);
						else
							result = this.editor.doFind(p, start, caseInsensitive);
						if (result) {
							this._incrementalFindSuccess = true;
							this._incrementalFindIgnoreSelection = true;
							this.editor.moveSelection(this.textView, result.index, result.index + result.length);
							this._incrementalFindIgnoreSelection = false;
							this.editor.reportStatus("Incremental find: " + p);
						} else {
							this.editor.reportStatus("Incremental find: " + p + " (not found)", true);
							this._incrementalFindSuccess = false;
						}
					}
				}
				return true;
			}.bind(this));
			this.textView.setAction("deletePrevious", function() {
				if (this._incrementalFindActive) {
					var p = this._incrementalFindPrefix;
					p = this._incrementalFindPrefix = p.substring(0, p.length-1);
					if (p.length===0) {
						this._incrementalFindSuccess = true;
						this._incrementalFindIgnoreSelection = true;
						this.textView.setCaretOffset(this.textView.getSelection().start);
						this._incrementalFindIgnoreSelection = false;
						this.toggleIncrementalFind();
						return true;
					}
					this.editor.reportStatus("Incremental find: " + p);
					var index = this.textView.getText().lastIndexOf(p, this.textView.getCaretOffset() - p.length - 1);
					if (index !== -1) {
						this._incrementalFindSuccess = true;
						this._incrementalFindIgnoreSelection = true;
						this.editor.moveSelection(this.textView, index,index+p.length);
						this._incrementalFindIgnoreSelection = false;
					} else {
						this.editor.reportStatus("Incremental find: " + p + " (not found)", true);
					}
					return true;
				} else {
					return false;
				}
			}.bind(this));
			
			// Tab actions
			this.textView.setAction("tab", function() {
				var selection = this.textView.getSelection();
				var model = this.textView.getModel();
				var firstLine = model.getLineAtOffset(selection.start);
				var lastLine = model.getLineAtOffset(selection.end>selection.start?selection.end - 1:selection.end);
				if (firstLine !== lastLine) {
					var lines = [];
					lines.push("");
					for (var i = firstLine; i <= lastLine; i++) {
						lines.push(model.getLine(i, true));
					}
					this.startUndo();
					var firstLineStart = model.getLineStart(firstLine);
					this.textView.setText(lines.join("\t"), firstLineStart, model.getLineEnd(lastLine, true));
					this.textView.setSelection(firstLineStart===selection.start?selection.start:selection.start + 1, selection.end + (lastLine - firstLine + 1));
					this.endUndo();
					return true;
				}
				return false;
			}.bind(this));
			this.textView.setKeyBinding(new orion.textview.KeyBinding(9, false, true), "Unindent Lines");
			this.textView.setAction("Unindent Lines", function() {
				var selection = this.textView.getSelection();
				var model = this.textView.getModel();
				var firstLine = model.getLineAtOffset(selection.start);
				var lastLine = model.getLineAtOffset(selection.end>selection.start?selection.end - 1:selection.end);
				var lines = [];
				for (var i = firstLine; i <= lastLine; i++) {
					var line = model.getLine(i, true);
					if (line.indexOf("\t") !== 0) { return false; }
					lines.push(line.substring(1));
				}
				this.startUndo();
				var firstLineStart = model.getLineStart(firstLine);
				var lastLineStart = model.getLineStart(lastLine);
				this.textView.setText(lines.join(""), firstLineStart, model.getLineEnd(lastLine, true));
				this.textView.setSelection(firstLineStart===selection.start?selection.start:selection.start - 1, selection.end - (lastLine - firstLine + 1) + (selection.end===lastLineStart+1?1:0));
				this.endUndo();
				return true;
			}.bind(this));
			
			this.textView.setKeyBinding(new orion.textview.KeyBinding(38, false, false, true), "Move Lines Up");
			this.textView.setAction("Move Lines Up", function() {
				var selection = this.textView.getSelection();
				var model = this.textView.getModel();
				var firstLine = model.getLineAtOffset(selection.start);
				if (firstLine===0) {
					return true;
				}
				this.startUndo();
				var lastLine = model.getLineAtOffset(selection.end>selection.start?selection.end - 1:selection.end);
				var isMoveFromLastLine = model.getLineCount()-1===lastLine;
				var lineStart = model.getLineStart(firstLine);
				var lineEnd = isMoveFromLastLine?model.getCharCount():model.getLineStart(lastLine+1);
				if (isMoveFromLastLine) {
					// Move delimiter preceding selection to end
					var delimiterStart = model.getLineEnd(firstLine-1);
					var delimiterEnd = model.getLineEnd(firstLine-1, true);
					var delimiter = model.getText(delimiterStart, delimiterEnd);
					lineStart = delimiterStart;
					model.setText(model.getText(delimiterEnd, lineEnd)+delimiter, lineStart, lineEnd);
				}
				var text = model.getText(lineStart, lineEnd);
				model.setText("", lineStart, lineEnd);
				var insertPos = model.getLineStart(firstLine-1);
				model.setText(text, insertPos, insertPos);
				var selectionEnd = insertPos+text.length-(isMoveFromLastLine?model.getLineDelimiter().length:0);
				this.textView.setSelection(insertPos, selectionEnd);
				this.endUndo();
				return true;
			}.bind(this));
			
			this.textView.setKeyBinding(new orion.textview.KeyBinding(40, false, false, true), "Move Lines Down");
			this.textView.setAction("Move Lines Down", function() {
				var selection = this.textView.getSelection();
				var model = this.textView.getModel();
				var firstLine = model.getLineAtOffset(selection.start);
				var lastLine = model.getLineAtOffset(selection.end>selection.start?selection.end - 1:selection.end);
				if (lastLine===model.getLineCount()-1) {
					return true;
				}
				this.startUndo();
				var isMoveIntoLastLine = lastLine===model.getLineCount()-2;
				var lineStart = model.getLineStart(firstLine);
				var lineEnd = model.getLineStart(lastLine+1);
				if (isMoveIntoLastLine) {
					// Move delimiter following selection to front
					var delimiterStart = model.getLineStart(lastLine+1)-model.getLineDelimiter().length;
					var delimiterEnd = model.getLineStart(lastLine+1);
					var delimiter = model.getText(delimiterStart, delimiterEnd);
					model.setText(delimiter + model.getText(lineStart, delimiterStart), lineStart, lineEnd);
				}
				var text = model.getText(lineStart, lineEnd);
				var insertPos = (isMoveIntoLastLine?model.getCharCount():model.getLineStart(lastLine+2))-(lineEnd-lineStart);
				model.setText("", lineStart, lineEnd);
				model.setText(text, insertPos, insertPos);
				var selStart = insertPos+(isMoveIntoLastLine?model.getLineDelimiter().length:0);
				var selEnd = insertPos+text.length;
				this.textView.setSelection(selStart, selEnd);
				this.endUndo();
				return true;
			}.bind(this));
			
			this.textView.setKeyBinding(new orion.textview.KeyBinding(38, true, false, true), "Copy Lines Up");
			this.textView.setAction("Copy Lines Up", function() {
				this.startUndo();
				var selection = this.textView.getSelection();
				var model = this.textView.getModel();
				var delimiter = model.getLineDelimiter();
				var firstLine = model.getLineAtOffset(selection.start);
				var lastLine = model.getLineAtOffset(selection.end>selection.start?selection.end - 1:selection.end);
				var lineStart = model.getLineStart(firstLine);
				var isCopyFromLastLine = model.getLineCount()-1===lastLine;
				var lineEnd = isCopyFromLastLine?model.getCharCount():model.getLineStart(lastLine+1);
				var text = model.getText(lineStart, lineEnd)+(isCopyFromLastLine?delimiter:""); //+ delimiter;
				//var insertPos = model.getLineStart(firstLine - 1);
				var insertPos = lineStart;
				model.setText(text, insertPos, insertPos);
				this.textView.setSelection(insertPos, insertPos+text.length-(isCopyFromLastLine?delimiter.length:0));
				this.endUndo();
				return true;
			}.bind(this));
			
			this.textView.setKeyBinding(new orion.textview.KeyBinding(40, true, false, true), "Copy Lines Down");
			this.textView.setAction("Copy Lines Down", function() {
				this.startUndo();
				var selection = this.textView.getSelection();
				var model = this.textView.getModel();
				var delimiter = model.getLineDelimiter();
				var firstLine = model.getLineAtOffset(selection.start);
				var lastLine = model.getLineAtOffset(selection.end>selection.start?selection.end - 1:selection.end);
				var lineStart = model.getLineStart(firstLine);
				var isCopyFromLastLine = model.getLineCount()-1===lastLine;
				var lineEnd = isCopyFromLastLine?model.getCharCount():model.getLineStart(lastLine+1);
				var text = (isCopyFromLastLine?delimiter:"")+model.getText(lineStart, lineEnd);
				//model.setText("", lineStart, lineEnd);
				//var insertPos = model.getLineStart(firstLine - 1);
				var insertPos = lineEnd;
				model.setText(text, insertPos, insertPos);
				this.textView.setSelection(insertPos+(isCopyFromLastLine?delimiter.length:0), insertPos+text.length);
				this.endUndo();
				return true;
			}.bind(this));
			
			this.textView.setKeyBinding(new orion.textview.KeyBinding('d', true, false, false), "Delete Selected Lines");
			this.textView.setAction("Delete Selected Lines", function() {
				this.startUndo();
				var selection = this.textView.getSelection();
				var model = this.textView.getModel();
				var firstLine = model.getLineAtOffset(selection.start);
				var lastLine = model.getLineAtOffset(selection.end>selection.start?selection.end - 1:selection.end);
				var lineStart = model.getLineStart(firstLine);
				var lineEnd = model.getLineCount()-1===lastLine?model.getCharCount():model.getLineStart(lastLine+1);
				model.setText("", lineStart, lineEnd);
				this.endUndo();
				return true;
			}.bind(this));
			
			// Go To Line action
			this.textView.setKeyBinding(new orion.textview.KeyBinding("l", true), "Goto Line...");
			this.textView.setAction("Goto Line...", function() {
				var line = this.textView.getModel().getLineAtOffset(this.textView.getCaretOffset());
				line = prompt("Go to line:", line + 1);
				if (line) {
					line = parseInt(line, 10);
					this.editor.onGotoLine(line-1, 0);
				}
				return true;
			}.bind(this));
			
		},
			
		toggleIncrementalFind: function() {
			this._incrementalFindActive = !this._incrementalFindActive;
			if (this._incrementalFindActive) {
				this.editor.reportStatus("Incremental find: " + this._incrementalFindPrefix);
				this.textView.addEventListener("Verify", this, this._incrementalFindListener.onVerify);
				this.textView.addEventListener("Selection", this, this._incrementalFindListener.onSelection);
			} else {
				this._incrementalFindPrefix = "";
				this.editor.reportStatus("");
				this.textView.removeEventListener("Verify", this, this._incrementalFindListener.onVerify);
				this.textView.removeEventListener("Selection", this, this._incrementalFindListener.onSelection);
				this.textView.setCaretOffset(this.textView.getCaretOffset());
			}
		},
		
		startUndo: function() {
			if (this.undoStack) {
				this.undoStack.startCompoundChange();
			}
		}, 
		
		endUndo: function() {
			if (this.undoStack) {
				this.undoStack.endCompoundChange();
			}
		}, 
	
		cancel: function() {
			this.toggleIncrementalFind();
		},
		
		isActive: function() {
			return this._incrementalFindActive;
		},
		
		isStatusActive: function() {
			return this._incrementalFindActive;
		},
		
		lineUp: function() {
			var index;
			if (this._incrementalFindActive) {
				var p = this._incrementalFindPrefix;
				var start = this.textView.getCaretOffset() - p.length - 1;
				if (this._incrementalFindSuccess === false) {
					start = this.textView.getModel().getCharCount() - 1;
				}
				index = this.textView.getText().lastIndexOf(p, start);
				if (index !== -1) {
					this._incrementalFindSuccess = true;
					this._incrementalFindIgnoreSelection = true;
					this.editor.moveSelection(this.textView, index,index+p.length);
					this._incrementalFindIgnoreSelection = false;
				} else {
					this.editor.reportStatus("Incremental find: " + p + " (not found)", true);	
					this._incrementalFindSuccess = false;
				}
				return true;
			}
			return false;
		},
		lineDown: function() {	
			var index;
			if (this._incrementalFindActive) {
				var p = this._incrementalFindPrefix;
				if (p.length===0) {
					return;
				}
				var start = this.textView.getSelection().start + 1;
				if (this._incrementalFindSuccess === false) {
					start = 0;
				}
				index = this.textView.getText().indexOf(p, start);
				if (index !== -1) {
					this._incrementalFindSuccess = true;
					this._incrementalFindIgnoreSelection = true;
					this.editor.moveSelection(this.textView, index, index+p.length);
					this._incrementalFindIgnoreSelection = false;
					this.editor.reportStatus("Incremental find: " + p);
				} else {
					this.editor.reportStatus("Incremental find: " + p + " (not found)", true);
					this._incrementalFindSuccess = false;
				}
				return true;
			}
			return false;
		},
		enter: function() {
			return false;
		}
	};
	return TextActions;
}());

orion.editor.SourceCodeActions = (function() {
	/**
	 * @param {orion.editor.Editor} editor
	 * @param {orion.textView.UndoStack} undoStack
	 * @param {orion.editor.ContentAssist} [contentAssist]
	 * @param {orion.editor.LinkedMode} [linkedMode]
	 */
	function SourceCodeActions(editor, undoStack, contentAssist, linkedMode) {
		this.editor = editor;
		this.textView = editor.getTextView();
		this.undoStack = undoStack;
		this.contentAssist = contentAssist;
		this.linkedMode = linkedMode;
		if (this.contentAssist) {
			this.contentAssist.addEventListener("accept", this.contentAssistProposalAccepted.bind(this));
		}
		
		this.init();
	}
	SourceCodeActions.prototype = {
		startUndo: function() {
			if (this.undoStack) {
				this.undoStack.startCompoundChange();
			}
		}, 
		
		endUndo: function() {
			if (this.undoStack) {
				this.undoStack.endCompoundChange();
			}
		}, 
		init: function() {
		
			// Block comment operations
			this.textView.setKeyBinding(new orion.textview.KeyBinding(191, true), "Toggle Line Comment");
			this.textView.setAction("Toggle Line Comment", function() {
				this.startUndo();
				var selection = this.textView.getSelection();
				var model = this.textView.getModel();
				var firstLine = model.getLineAtOffset(selection.start);
				var lastLine = model.getLineAtOffset(selection.end>selection.start?selection.end - 1:selection.end);
				var uncomment = true;
				var lineText;
				for (var i = firstLine; i <= lastLine && uncomment; i++) {
					lineText = this.textView.getModel().getLine(i);
					var index = lineText.indexOf("//");
					if (index === -1) {
						uncomment = false;
					} else {
						if (index !== 0) {
							var j;
							for (j=0; j<index; j++) {
								var c = lineText.charCodeAt(j);
								if (!(c === 32 || c === 9)) {
									break;
								}
							}
							uncomment = j === index;
						}
					}
				}
				var k, lines = [];
				var firstLineStart = model.getLineStart(firstLine);
				if (uncomment) {
					var lastLineStart = model.getLineStart(lastLine);
					for (k = firstLine; k <= lastLine; k++) {
						var line = model.getLine(k, true);
						var commentIndex = lineText.indexOf("//");
						lines.push(line.substring(0, commentIndex) + line.substring(commentIndex + 2));
					}
					this.textView.setText(lines.join(""), firstLineStart, model.getLineEnd(lastLine, true));
					this.textView.setSelection(firstLineStart===selection.start?selection.start:selection.start - 2, selection.end - (2 * (lastLine - firstLine + 1)) + (selection.end===lastLineStart+1?2:0));
				} else {
					lines.push("");
					for (k = firstLine; k <= lastLine; k++) {
						lines.push(model.getLine(k, true));
					}
					this.textView.setText(lines.join("//"), firstLineStart, model.getLineEnd(lastLine, true));
					this.textView.setSelection(firstLineStart===selection.start?selection.start:selection.start + 2, selection.end + (2 * (lastLine - firstLine + 1)));
				}
				this.endUndo();
				return true;
			}.bind(this));
			
			function findEnclosingComment(model, start, end) {
				var open = "/*", close = "*/";
				var firstLine = model.getLineAtOffset(start);
				var lastLine = model.getLineAtOffset(end);
				var i, line, extent, openPos, closePos;
				var commentStart, commentEnd;
				for (i=firstLine; i >= 0; i--) {
					line = model.getLine(i);
					extent = (i === firstLine) ? start - model.getLineStart(firstLine) : line.length;
					openPos = line.lastIndexOf(open, extent);
					closePos = line.lastIndexOf(close, extent);
					if (closePos > openPos) {
						break; // not inside a comment
					} else if (openPos !== -1) {
						commentStart = model.getLineStart(i) + openPos;
						break;
					}
				}
				for (i=lastLine; i < model.getLineCount(); i++) {
					line = model.getLine(i);
					extent = (i === lastLine) ? end - model.getLineStart(lastLine) : 0;
					openPos = line.indexOf(open, extent);
					closePos = line.indexOf(close, extent);
					if (openPos !== -1 && openPos < closePos) {
						break;
					} else if (closePos !== -1) {
						commentEnd = model.getLineStart(i) + closePos;
						break;
					}
				}
				return {commentStart: commentStart, commentEnd: commentEnd};
			}
			
			this.textView.setKeyBinding(new orion.textview.KeyBinding(191, true, true), "Add Block Comment");
			this.textView.setAction("Add Block Comment", function() {
				var selection = this.textView.getSelection();
				var model = this.textView.getModel();
				var open = "/*", close = "*/", commentTags = new RegExp("/\\*" + "|" + "\\*/", "g");
				var firstLine = model.getLineAtOffset(selection.start);
				var lastLine = model.getLineAtOffset(selection.end);
				
				var result = findEnclosingComment(model, selection.start, selection.end);
				if (result.commentStart !== undefined && result.commentEnd !== undefined) {
					return true; // Already in a comment
				}
				
				var text = model.getText(selection.start, selection.end);
				if (text.length === 0) { return true; }
				
				var oldLength = text.length;
				text = text.replace(commentTags, "");
				var newLength = text.length;
				
				this.startUndo();
				model.setText(open + text + close, selection.start, selection.end);
				this.textView.setSelection(selection.start + open.length, selection.end + open.length + (newLength-oldLength));
				this.endUndo();
				return true;
			}.bind(this));
			
			this.textView.setKeyBinding(new orion.textview.KeyBinding(220, true, true), "Remove Block Comment");
			this.textView.setAction("Remove Block Comment", function() {
				var selection = this.textView.getSelection();
				var model = this.textView.getModel();
				var open = "/*", close = "*/";
				var firstLine = model.getLineAtOffset(selection.start);
				var lastLine = model.getLineAtOffset(selection.end);
				
				// Try to shrink selection to a comment block
				var selectedText = model.getText(selection.start, selection.end);
				var newStart, newEnd;
				var i;
				for(i=0; i < selectedText.length; i++) {
					if (selectedText.substring(i, i + open.length) === open) {
						newStart = selection.start + i;
						break;
					}
				}
				for (; i < selectedText.length; i++) {
					if (selectedText.substring(i, i + close.length) === close) {
						newEnd = selection.start + i;
						break;
					}
				}
				
				this.startUndo();
				if (newStart !== undefined && newEnd !== undefined) {
					model.setText(model.getText(newStart + open.length, newEnd), newStart, newEnd + close.length);
					this.textView.setSelection(newStart, newEnd);
				} else {
					// Otherwise find enclosing comment block
					var result = findEnclosingComment(model, selection.start, selection.end);
					if (result.commentStart === undefined || result.commentEnd === undefined) {
						return true;
					}
					
					var text = model.getText(result.commentStart + open.length, result.commentEnd);
					model.setText(text, result.commentStart, result.commentEnd + close.length);
					this.textView.setSelection(selection.start - open.length, selection.end - close.length);
				}
				this.endUndo();
				return true;
			}.bind(this));
		},
		/**
		 * Called when a content assist proposal has been accepted. Inserts the proposal into the
		 * document. Activates Linked Mode if applicable for the selected proposal.
		 */
		contentAssistProposalAccepted: function(event) {
			/**
			 * The event.proposal may be either a simple string or an object with this shape:
			 * {   proposal: "[proposal string]", // Actual text of the proposal
			 *     positions: [{
			 *         offset: 10, // Offset of start position of parameter i
			 *         length: 3  // Length of parameter string for parameter i
			 *     }], // One object for each parameter; can be null
			 *     escapePosition: 19 // Offset that caret will be placed at after exiting Linked Mode; can be null
			 * }
			 * Offsets are relative to the text buffer.
			 */
			var proposalInfo = event.data.proposal;
			var proposal;
			if (typeof proposalInfo === "string") {
				proposal = proposalInfo;
			} else if (typeof proposalInfo.proposal === "string") {
				proposal = proposalInfo.proposal;
			}
			this.textView.setText(proposal, event.data.start, event.data.end);
			
			if (proposalInfo.positions && this.linkedMode) {
				var positionGroups = [];
				for (var i = 0; i < proposalInfo.positions.length; ++i) {
					positionGroups[i] = {
						positions: [{
							offset: proposalInfo.positions[i].offset,
							length: proposalInfo.positions[i].length
						}]
					};
				}

				var linkedModeModel = {
					groups: positionGroups,
					escapePosition: proposalInfo.escapePosition
				};
				this.linkedMode.enterLinkedMode(linkedModeModel);
			}
			return true;
		},
		cancel: function() {
			return false;
		},
		isActive: function() {
			return true;
		},
		isStatusActive: function() {
			// SourceCodeActions never reports status
			return false;
		},
		lineUp: function() {
			return false;
		},
		lineDown: function() {
			return false;
		},
		enter: function() {
			// Auto indent
			var selection = this.textView.getSelection();
			if (selection.start === selection.end) {
				var model = this.textView.getModel();
				var lineIndex = model.getLineAtOffset(selection.start);
				var lineText = model.getLine(lineIndex);
				var lineStart = model.getLineStart(lineIndex);
				var index = 0, end = selection.start - lineStart, c;
				while (index < end && ((c = lineText.charCodeAt(index)) === 32 || c === 9)) { index++; }
				if (index > 0) {
					var prefix = lineText.substring(0, index);
					index = end;
					while (index < lineText.length && ((c = lineText.charCodeAt(index++)) === 32 || c === 9)) { selection.end++; }
					this.textView.setText(model.getLineDelimiter() + prefix, selection.start, selection.end);
					return true;
				}
			}
			return false;
		}
	};
	return SourceCodeActions;
}());

orion.editor.LinkedMode = (function() {
	function LinkedMode(editor) {
		this.editor = editor;
		this.textView = editor.getTextView();
		
		/**
		 * The variables used by the Linked Mode. The elements of linkedModePositions have following structure:
		 * {
		 *     offset: 10, // The offset of the position counted from the beginning of the text buffer
		 *     length: 3 // The length of the position (selection)
		 * }
		 *
		 * The linkedModeEscapePosition contains an offset (counted from the beginning of the text buffer) of a
		 * position where the caret will be placed after exiting from the Linked Mode.
		 */
		this.linkedModeActive = false;
		this.linkedModePositions = [];
		this.linkedModeCurrentPositionIndex = 0;
		this.linkedModeEscapePosition = 0;
		
		/**
		 * Listener called when Linked Mode is active. Updates position's offsets and length
		 * on user change. Also escapes the Linked Mode if the text buffer was modified outside of the Linked Mode positions.
		 */
		this.linkedModeListener = {
			onVerify: function(event) {
				var changeInsideGroup = false;
				var offsetDifference = 0;
				for (var i = 0; i < this.linkedModePositions.length; ++i) {
					var position = this.linkedModePositions[i];
					if (changeInsideGroup) {
						// The change has already been noticed, update the offsets of all positions next to the changed one
						position.offset += offsetDifference;
					} else if (event.start >= position.offset && event.end <= position.offset + position.length) {
						// The change was done in the current position, update its length
						var oldLength = position.length;
						position.length = (event.start - position.offset) + event.text.length + (position.offset + position.length - event.end);
						offsetDifference = position.length - oldLength;
						changeInsideGroup = true;
					}
				}

				if (changeInsideGroup) {
					// Update escape position too
					this.linkedModeEscapePosition += offsetDifference;
				} else {
					// The change has been done outside of the positions, exit the Linked Mode
					this.cancel();
				}
			}.bind(this)
		};
	}
	LinkedMode.prototype = {
		/**
		 * Starts Linked Mode, selects the first position and registers the listeners.
		 * @parma {Object} linkedModeModel An object describing the model to be used by linked mode.
		 * Contains one or more position groups. If one positions in a group is edited, the other positions in the
		 * group are edited the same way. The structure is as follows:<pre>
		 * {
		 *     groups: [{
		 *         positions: [{
		 *             offset: 10, // Relative to the text buffer
		 *             length: 3
		 *         }]
		 *     }],
		 *     escapePosition: 19, // Relative to the text buffer
		 * }</pre>
		 */
		enterLinkedMode: function(linkedModeModel) {
			if (this.linkedModeActive) {
				return;
			}
			this.linkedModeActive = true;

			// NOTE: only the first position from each group is supported for now
			this.linkedModePositions = [];
			for (var i = 0; i < linkedModeModel.groups.length; ++i) {
				var group = linkedModeModel.groups[i];
				this.linkedModePositions[i] = {
					offset: group.positions[0].offset,
					length: group.positions[0].length
				};
			}

			this.linkedModeEscapePosition = linkedModeModel.escapePosition;
			this.linkedModeCurrentPositionIndex = 0;
			this.selectTextForLinkedModePosition(this.linkedModePositions[this.linkedModeCurrentPositionIndex]);

			this.textView.addEventListener("Verify", this, this.linkedModeListener.onVerify);

			this.textView.setKeyBinding(new orion.textview.KeyBinding(9), "nextLinkedModePosition");
			this.textView.setAction("nextLinkedModePosition", function() {
				// Switch to the next group on TAB key
				this.linkedModeCurrentPositionIndex = ++this.linkedModeCurrentPositionIndex % this.linkedModePositions.length;
				this.selectTextForLinkedModePosition(this.linkedModePositions[this.linkedModeCurrentPositionIndex]);
				return true;
			}.bind(this));
			
			this.textView.setKeyBinding(new orion.textview.KeyBinding(9, false, true), "previousLinkedModePosition");
			this.textView.setAction("previousLinkedModePosition", function() {
				this.linkedModeCurrentPositionIndex = this.linkedModeCurrentPositionIndex > 0 ? this.linkedModeCurrentPositionIndex-1 : this.linkedModePositions.length-1;
				this.selectTextForLinkedModePosition(this.linkedModePositions[this.linkedModeCurrentPositionIndex]);
				return true;
			}.bind(this));

			this.editor.reportStatus("Linked Mode entered");
		},
		isActive: function() {
			return this.linkedModeActive;
		},
		isStatusActive: function() {
			return this.linkedModeActive;
		},
		enter: function() {
			this.cancel();
			return true;
		},
		/** Exits Linked Mode. Places the caret at linkedModeEscapePosition. */
		cancel: function() {
			if (!this.linkedModeActive) {
				return;
			}
			this.linkedModeActive = false;
			this.textView.removeEventListener("Verify", this, this.linkedModeListener.onVerify);
			this.textView.setKeyBinding(new orion.textview.KeyBinding(9), "tab");
			this.textView.setKeyBinding(new orion.textview.KeyBinding(9, false, true), null);
			
			this.textView.setCaretOffset(this.linkedModeEscapePosition, false);

			this.editor.reportStatus("Linked Mode exited");
		},
		/**
		 * Updates the selection in the textView for given Linked Mode position.
		 */
		selectTextForLinkedModePosition: function(position) {
			this.textView.setSelection(position.offset, position.offset + position.length);
		}
	};
	return LinkedMode;
}());

if (typeof window !== "undefined" && typeof window.define !== "undefined") {
	define(['orion/textview/undoStack', 'orion/textview/keyBinding', 'orion/textview/rulers'], function() {
		return orion.editor;
	});
}
