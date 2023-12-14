"use client";

import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useOrganization } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ThreadValidation } from "@/lib/validations/thread";
import { createThread } from "@/lib/actions/thread.actions";
import { ToastContainer, toast } from "react-toastify";
import Image from "next/image";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";

import { useState } from "react";

interface ThreadProps {
  userId: string;
  userName: string;
}

function PostThread({ userId, userName }: Readonly<ThreadProps>) {
  const router = useRouter();
  const pathname = usePathname();

  const [showImage, setShowImage] = useState(false);
  const { organization } = useOrganization();

  const form = useForm<z.infer<typeof ThreadValidation>>({
    resolver: zodResolver(ThreadValidation),
    defaultValues: {
      thread: "",
      accountId: userId,
    },
  });

  const onSubmit = async (values: z.infer<typeof ThreadValidation>) => {
    try {
      await createThread({
        text: values.thread,
        author: userId,
        communityId: organization ? organization.id : null,
        path: pathname,
      });
      toast.success("Gönderi başarıyla paylaşıldı.");
      router.push("/");
    } catch (error) {
      toast.error("Gönderi paylaşılırken bir hata oluştu.");
    } finally {
      // reset the form
      form.reset({
        thread: "",
        accountId: userId,
      });
    }
  };

  return (
    <Form {...form}>
      <ToastContainer limit={3} theme={"dark"} autoClose={1000} />

      <form
        className="flex flex-col gap-3 items-end"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <FormField
          control={form.control}
          name="thread"
          render={({ field }) => (
            <FormItem className="flex w-full flex-col gap-2">
              <FormControl className="no-focus border border-dark-4 bg-dark-2 text-light-1">
                <Textarea
                  {...field}
                  placeholder="Gönderi paylaş"
                  style={{ minHeight: 100, maxHeight: 200 }}
                  maxLength={550}
                />
              </FormControl>
              <div className="flex items-center w-full justify-between">
                <div className="mb-3 pl-1">
                  <div className="flex gap-3.5 mb-1">
                    <Image
                      src="/assets/share-image.svg"
                      alt="image"
                      width={24}
                      height={24}
                      className="cursor-pointer object-contain"
                    />
                    <Image
                      src="/assets/gif.svg"
                      alt="emoji"
                      width={24}
                      height={24}
                      className="cursor-pointer object-contain"
                    />
                    <Image
                      src="/assets/emoji.svg"
                      alt="emoji"
                      width={22}
                      height={22}
                      className="cursor-pointer object-contain"
                      onClick={() => setShowImage(!showImage)}
                    />
                    {showImage && (
                      <div style={{ position: "relative" }}>
                        <div
                          style={{
                            position: "absolute",
                            zIndex: 1,
                            overflow: "auto",
                          }}
                        >
                          <Picker
                            data={data}
                            onEmojiSelect={(emoji: any) => {
                              field.onChange(`${field.value}${emoji.native}`);
                            }}
                            perLine={8}
                            emojiSize={24}
                            locale="tr"
                            navPosition="top"
                            theme="dark"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="mt-2 -mb-3">
                    {field.value.length >= 550 && (
                      <p className="text-red-600 pb-3">
                        Max karakter sınırına ulaşıldı.
                      </p>
                    )}
                  </div>
                </div>

                <Button
                  type="submit"
                  className="bg-primary-500 w-[8em] mb-4"
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
