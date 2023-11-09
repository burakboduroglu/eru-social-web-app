import * as z from 'zod';

// For Thrad (Post)
export const ThreadValidation = z.object({
    thread: z.string().min(3, {message: 'En az 3 karakter giriniz.'}),
    accountId: z.string()
})

// For Comments

export const CommentValidation = z.object({
    thread: z.string().min(3, {message: 'En az 3 karakter giriniz.'}),
})