"use client";

import React, { useState, useEffect, useRef } from "react";
import { Input } from "./input";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import styled from "@emotion/styled";

function useDebounce<T>(value: T, delay: number = 500): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(timer);
        };
    }, [value, delay]);

    return debouncedValue;
}

export type Action = {
    id: string;
    label: string;
    icon?: React.ReactNode;
    description?: string;
    short?: string;
    end?: string;
}

interface SearchResult {
    actions: Action[];
}

const SearchContainer = styled.div`
    position: relative;
    width: 100%;

    .search-input {
        width: 100%;
        padding: 8px 12px;
        padding-left: 32px;
        border-radius: 4px;
        border: 1px solid var(--background-modifier-border);
        background-color: var(--background-primary);
        color: var(--text-normal);
        font-size: 14px;

        &:focus {
            outline: none;
            box-shadow: 0 0 0 2px var(--background-modifier-border-focus);
        }

        &::placeholder {
            color: var(--text-muted);
        }
    }

    .search-icon {
        position: absolute;
        left: 8px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--text-muted);
        pointer-events: none;
    }

    .results-container {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        margin-top: 4px;
        background: var(--background-primary);
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        max-height: 300px;
        overflow-y: auto;
        z-index: 1000;
    }

    .result-item {
        padding: 8px 12px;
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        border-bottom: 1px solid var(--background-modifier-border);
        transition: background-color 0.2s ease;

        &:last-child {
            border-bottom: none;
        }

        &:hover {
            background-color: var(--background-modifier-hover);
        }

        .item-icon {
            flex-shrink: 0;
            color: var(--text-muted);
        }

        .item-content {
            flex-grow: 1;
            min-width: 0;
        }

        .item-label {
            color: var(--text-normal);
            font-size: 14px;
            margin-bottom: 2px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .item-description {
            color: var(--text-muted);
            font-size: 12px;
        }

        .item-end {
            flex-shrink: 0;
            color: var(--text-muted);
            font-size: 12px;
        }
    }
`;

interface ActionSearchBarProps {
    actions?: Action[];
    onSelect?: (action: Action) => void;
    placeholder?: string;
}

const allActions: Action[] = [
    {
        id: "1",
        label: "Book tickets",
        icon: <Search className="h-4 w-4 text-blue-500" />,
        description: "Operator",
        short: "⌘K",
        end: "Agent",
    },
    {
        id: "2",
        label: "Summarize",
        icon: <Search className="h-4 w-4 text-orange-500" />,
        description: "gpt-4o",
        short: "⌘cmd+p",
        end: "Command",
    },
    {
        id: "3",
        label: "Screen Studio",
        icon: <Search className="h-4 w-4 text-purple-500" />,
        description: "gpt-4o",
        short: "",
        end: "Application",
    },
    {
        id: "4",
        label: "Talk to Jarvis",
        icon: <Search className="h-4 w-4 text-green-500" />,
        description: "gpt-4o voice",
        short: "",
        end: "Active",
    },
    {
        id: "5",
        label: "Translate",
        icon: <Search className="h-4 w-4 text-blue-500" />,
        description: "gpt-4o",
        short: "",
        end: "Command",
    },
];

export function ActionSearchBar({ 
    actions = allActions, 
    onSelect,
    placeholder = "Search..."
}: ActionSearchBarProps) {
    const [query, setQuery] = useState("");
    const [result, setResult] = useState<SearchResult | null>(null);
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const debouncedQuery = useDebounce(query, 200);

    useEffect(() => {
        if (!debouncedQuery && !isFocused) {
            setResult(null);
            return;
        }

        const normalizedQuery = debouncedQuery.toLowerCase().trim();
        const filteredActions = actions.filter((action) => {
            const searchableText = action.label.toLowerCase();
            return searchableText.includes(normalizedQuery);
        });

        setResult({ actions: filteredActions });
    }, [debouncedQuery, isFocused, actions]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setQuery(e.target.value);
    };

    const handleActionClick = (action: Action) => {
        onSelect?.(action);
        setQuery("");
        setResult(null);
        setIsFocused(false);
        inputRef.current?.blur();
    };

    return (
        <SearchContainer>
            <Search className="search-icon h-4 w-4" />
            <input
                ref={inputRef}
                type="text"
                className="search-input"
                placeholder={placeholder}
                value={query}
                onChange={handleInputChange}
                onFocus={() => setIsFocused(true)}
                onBlur={() => {
                    // Small delay to allow click events to fire
                    setTimeout(() => {
                        setIsFocused(false);
                        if (!query) {
                            setResult(null);
                        }
                    }, 200);
                }}
            />
            {(isFocused || query) && result && result.actions.length > 0 && (
                <motion.div
                    className="results-container"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                >
                    {result.actions.map((action) => (
                        <div
                            key={action.id}
                            className="result-item"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                handleActionClick(action);
                            }}
                        >
                            {action.icon && (
                                <span className="item-icon">{action.icon}</span>
                            )}
                            <div className="item-content">
                                <div className="item-label">{action.label}</div>
                                {action.description && (
                                    <div className="item-description">
                                        {action.description}
                                    </div>
                                )}
                            </div>
                            {action.end && (
                                <span className="item-end">{action.end}</span>
                            )}
                        </div>
                    ))}
                </motion.div>
            )}
        </SearchContainer>
    );
}
