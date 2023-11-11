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
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { ThreadValidation } from "@/lib/validations/thread";
import { createThread } from "@/lib/actions/thread.actions";
import { capitalize } from "@/lib/utils";

interface ThreadProps {
  userId: string;
  userName: string;
}

function PostThread({ userId, userName }: Readonly<ThreadProps>) {
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

    // After your logic, reset the form
    form.reset({
      thread: "",
    });

    router.push("/");
  };

  return (
    <Form {...form}>
      <form
        className="mt-3 flex flex-col gap-3 items-end"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <FormField
          control={form.control}
          name="thread"
          render={({ field }) => (
            <FormItem className="flex w-full flex-col gap-3">
              <FormControl className="no-focus border border-dark-4 bg-dark-2 text-light-1">
                <Textarea rows={3} {...field} placeholder="Gönderi paylaş" />
              </FormControl>
              <div className="flex items-center w-full justify-between">
                <FormLabel className="text-amber-50 mb-3 ml-1 text-[0.85em]">
                  Merhaba, {capitalize(userName)} gönderi paylaşırken topluluk kurallarına
                  uyalım.😊
                </FormLabel>
                <Button
                  type="submit"
                  className="bg-primary-500 w-[8em] mb-3"
                  disabled={!field.value.length || !field.value.trim()}
                >
                  Yayınla
                </Button>
              </div>
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}

export default PostThread;
