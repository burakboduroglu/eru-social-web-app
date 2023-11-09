"use client";

// Shadcn UI
import {
    Form,
    FormControl,
    FormLabel,
    FormMessage,
    FormField,
    FormDescription,
    FormItem,
} from "../ui/form";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";

// About Zod
import { zodResolver } from "@hookform/resolvers/zod";
import { ThreadValidation } from "@/lib/validations/thread";
import * as z from 'zod';

// React
import { useForm } from "react-hook-form";

// Actions
import {createThread} from "@/lib/actions/thread.actions";

// Next
import { usePathname, useRouter } from "next/navigation";

interface Props {
    user: {
        id: string;
        objectId: string;
        username: string;
        name: string;
        bio: string;
        image: string;
    };
}

export default function PostThread({ userId } : { userId: string}){
    const router = useRouter();
    const pathname = usePathname();

    const form = useForm({
        resolver: zodResolver(ThreadValidation), // use for validation with Zod
        defaultValues: {
            thread: '',
            accountId: userId,
        },
    });

    const onSubmit = async (values: z.infer<typeof ThreadValidation>) => {
        await createThread({
            text: values.thread,
            author: userId,
            communityId: null,
            path: pathname
        });
    }
    router.push("/")

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="mt-5 ml-1 flex flex-col justify-start gap-5">
                <FormField
                    control={form.control}
                    name="thread"
                    render={({ field }) => (
                        <FormItem className="flex flex-col gap-3 w-full">
                            <FormLabel className="text-base-semibold text-light-2">
                                İçerik
                            </FormLabel>
                            <FormControl className="no-focus border border-dark-4 bg-dark-3 text-light-1">
                                <Textarea
                                    rows={5}
                                    {...field}
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />
                <Button type="submit" className="bg-primary-500">
                    Yayınla
                </Button>
            </form>
        </Form>
    )
}