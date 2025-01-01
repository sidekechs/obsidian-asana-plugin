import React, { useState, useEffect } from 'react';
import styled from '@emotion/styled';
import { AsanaService } from '../services/AsanaService';

interface Comment {
    gid: string;
    author: string;
    timestamp: Date;
    text: string;
    resource_subtype: string;
}

interface TaskCommentsProps {
    taskId: string;
    asanaService: AsanaService;
}

const Container = styled.div`
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    height: 100%;
`;

const CommentsList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 1rem;
    overflow-y: auto;
    flex-grow: 1;
`;

const CommentItem = styled.div`
    background-color: var(--background-secondary);
    border-radius: 8px;
    padding: 1rem;
`;

const CommentHeader = styled.div`
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
    color: var(--text-muted);
    font-size: 0.9em;
`;

const Author = styled.span`
    font-weight: bold;
    color: var(--text-normal);
`;

const CommentText = styled.div`
    white-space: pre-wrap;
    word-break: break-word;
`;

const NewCommentSection = styled.div`
    display: flex;
    flex-direction: column;
    gap: 1rem;
    border-top: 1px solid var(--background-modifier-border);
    padding-top: 1rem;
`;

const CommentInput = styled.textarea`
    width: 100%;
    min-height: 100px;
    padding: 0.5rem;
    border-radius: 4px;
    border: 1px solid var(--background-modifier-border);
    background-color: var(--background-primary);
    resize: vertical;
`;

const Button = styled.button`
    padding: 0.5rem 1rem;
    border-radius: 4px;
    background-color: var(--interactive-accent);
    color: var(--text-on-accent);
    border: none;
    cursor: pointer;
    align-self: flex-end;
    transition: opacity 0.2s ease;

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
`;

const LoadingSpinner = styled.div`
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100px;
`;

export const TaskComments: React.FC<TaskCommentsProps> = ({ taskId, asanaService }) => {
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const loadComments = async () => {
        try {
            const fetchedComments = await asanaService.getTaskComments(taskId);
            setComments(fetchedComments);
        } catch (error) {
            console.error('Error loading comments:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadComments();
    }, [taskId]);

    const handleSubmit = async () => {
        if (!newComment.trim()) return;

        setIsSubmitting(true);
        try {
            await asanaService.addComment(taskId, newComment);
            setNewComment('');
            await loadComments();
        } catch (error) {
            console.error('Error adding comment:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatDate = (date: Date) => {
        return date.toLocaleString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (isLoading) {
        return <LoadingSpinner>Loading comments...</LoadingSpinner>;
    }

    return (
        <Container>
            <CommentsList>
                {comments.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        No comments yet
                    </div>
                ) : (
                    comments.map((comment) => (
                        <CommentItem key={comment.gid}>
                            <CommentHeader>
                                <Author>{comment.author}</Author>
                                <span>{formatDate(comment.timestamp)}</span>
                            </CommentHeader>
                            <CommentText>{comment.text}</CommentText>
                        </CommentItem>
                    ))
                )}
            </CommentsList>

            <NewCommentSection>
                <CommentInput
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Write a comment..."
                />
                <Button
                    onClick={handleSubmit}
                    disabled={!newComment.trim() || isSubmitting}
                >
                    {isSubmitting ? 'Adding...' : 'Add Comment'}
                </Button>
            </NewCommentSection>
        </Container>
    );
};
