"use client";

// Zod
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
// React - Next- Clerk
import { useForm } from "react-hook-form";
import { useOrganization } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";
// shadcn ui
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { ThreadValidation } from "@/lib/validations/thread";
import { createThread } from "@/lib/actions/thread.actions";


interface ThreadProps {
    userId: string;
}

function PostThread({ userId }: ThreadProps) {
    const router = useRouter();
    const pathname = usePathname();

    const { organization } = useOrganization();

    const form = useForm<z.infer<typeof ThreadValidation>>({
        resolver: zodResolver(ThreadValidation),
        defaultValues: {
            thread: "",
            accountId: userId,
        },
    });

    const onSubmit = async (values: z.infer<typeof ThreadValidation>) => {
        await createThread({
            text: values.thread,
            author: userId,
            communityId: organization ? organization.id : null,
            path: pathname,
        });

        router.push("/");
    };

    return (
        <Form {...form}>
            <form
                className='mt-10 flex flex-col justify-start gap-10'
                onSubmit={form.handleSubmit(onSubmit)}
            >
                <FormField
                    control={form.control}
                    name='thread'
                    render={({ field }) => (
                        <FormItem className='flex w-full flex-col gap-3'>
                            <FormLabel className='text-base-semibold text-light-2'>
                                İçerik
                            </FormLabel>
                            <FormControl className='no-focus border border-dark-4 bg-dark-3 text-light-1'>
                                <Textarea rows={5} {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <Button type='submit' className='bg-primary-500'>
                    Yayınla
                </Button>
            </form>
        </Form>
    );
}

export default PostThread;