export interface Task {
    id: string;
    status: 'pending' | 'processing' | 'success' | 'failed';
    progress: number;
    // TODO
}