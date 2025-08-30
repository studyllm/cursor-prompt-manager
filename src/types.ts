export interface Prompt {
    id: string;
    title: string;
    content: string;
    description?: string;
    category: string;
    tags: string[];
    variables: Variable[];
    createdAt: Date;
    updatedAt: Date;
    usageCount: number;
    isFavorite: boolean;
}

export interface Variable {
    name: string;
    description?: string;
    defaultValue?: string;
    type: 'text' | 'multiline' | 'select' | 'number' | 'date' | 'selection' | 'filename' | 'filepath' | 'custom';
    placeholder?: string;
    required?: boolean;
    options?: string[]; // For select type
}

export interface Category {
    id: string;
    name: string;
    description?: string;
    parentId?: string;
    color?: string;
    icon?: string;
    order: number;
}

export interface PromptCreateInput {
    title: string;
    content: string;
    description?: string;
    category: string;
    tags?: string[];
    variables?: Variable[];
}

export interface PromptUpdateInput extends Partial<PromptCreateInput> {
    id: string;
}

export interface PromptLibrary {
    prompts: Prompt[];
    categories: Category[];
    version: string;
    exportedAt: Date;
}
