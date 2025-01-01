import { App, Modal, ButtonComponent, TextAreaComponent } from 'obsidian';
import { AsanaService } from '../services/AsanaService';

interface TaskComment {
    gid: string;
    author: string;
    timestamp: Date;
    text: string;
    resource_subtype: string;
}

export class TaskCommentsModal extends Modal {
    private comments: TaskComment[] = [];
    private taskId: string;
    private asanaService: AsanaService;
    private commentInput: TextAreaComponent;

    constructor(app: App, taskId: string, asanaService: AsanaService) {
        super(app);
        this.taskId = taskId;
        this.asanaService = asanaService;
    }

    async onOpen() {
        await this.loadComments();
        this.render();
    }

    private async loadComments() {
        try {
            this.comments = await this.asanaService.getTaskComments(this.taskId);
            this.render();
        } catch (error) {
            console.error('Error loading comments:', error);
        }
    }

    private formatDate(date: Date): string {
        return date.toLocaleString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    private render() {
        const { contentEl } = this;
        contentEl.empty();

        // Header
        contentEl.createEl('h2', { text: 'Task Comments' });

        // Comments section
        const commentsContainer = contentEl.createEl('div', { cls: 'comments-container' });
        
        if (this.comments.length === 0) {
            commentsContainer.createEl('p', { 
                text: 'No comments yet',
                cls: 'no-comments'
            });
        } else {
            this.comments.forEach(comment => {
                const commentEl = commentsContainer.createEl('div', { cls: 'comment' });
                
                const headerEl = commentEl.createEl('div', { cls: 'comment-header' });
                headerEl.createEl('span', { 
                    text: comment.author,
                    cls: 'comment-author'
                });
                headerEl.createEl('span', { 
                    text: this.formatDate(comment.timestamp),
                    cls: 'comment-timestamp'
                });

                commentEl.createEl('div', { 
                    text: comment.text,
                    cls: 'comment-text'
                });
            });
        }

        // New comment section
        const newCommentSection = contentEl.createEl('div', { cls: 'new-comment-section' });
        
        this.commentInput = new TextAreaComponent(newCommentSection)
            .setPlaceholder('Write a comment...')
            .onChange(() => {
                addButton.setDisabled(!this.commentInput.getValue().trim());
            });

        const buttonContainer = newCommentSection.createEl('div', { cls: 'button-container' });

        const addButton = new ButtonComponent(buttonContainer)
            .setButtonText('Add Comment')
            .setDisabled(true)
            .onClick(async () => {
                const text = this.commentInput.getValue().trim();
                if (!text) return;

                try {
                    await this.asanaService.addComment(this.taskId, text);
                    this.commentInput.setValue('');
                    await this.loadComments();
                } catch (error) {
                    console.error('Error adding comment:', error);
                }
            });

        // Add styles
        this.addStyles();
    }

    private addStyles() {
        const styleEl = document.head.createEl('style');
        styleEl.textContent = `
            .comments-container {
                max-height: 400px;
                overflow-y: auto;
                margin: 1rem 0;
                padding-right: 10px;
            }

            .comment {
                background-color: var(--background-secondary);
                border-radius: 8px;
                padding: 1rem;
                margin-bottom: 1rem;
            }

            .comment-header {
                display: flex;
                justify-content: space-between;
                margin-bottom: 0.5rem;
                color: var(--text-muted);
                font-size: 0.9em;
            }

            .comment-author {
                font-weight: bold;
                color: var(--text-normal);
            }

            .comment-text {
                white-space: pre-wrap;
                word-break: break-word;
            }

            .new-comment-section {
                margin-top: 1rem;
                border-top: 1px solid var(--background-modifier-border);
                padding-top: 1rem;
            }

            .new-comment-section textarea {
                width: 100%;
                min-height: 100px;
                margin-bottom: 1rem;
                padding: 0.5rem;
                border-radius: 4px;
                border: 1px solid var(--background-modifier-border);
                background-color: var(--background-primary);
            }

            .button-container {
                display: flex;
                justify-content: flex-end;
            }

            .no-comments {
                text-align: center;
                color: var(--text-muted);
                padding: 2rem;
            }
        `;
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
