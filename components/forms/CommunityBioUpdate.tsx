"use client";

import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { CommunityValidation } from "@/lib/validations/community";
import * as z from "zod";
import "react-toastify/dist/ReactToastify.css";
import { toast, ToastContainer } from "react-toastify";
import { updateCommunityBio } from "@/lib/actions/community.actions";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  community: {
    id: string;
    bio: string;
  };
}

const CommunityBioUpdate = ({ community }: Props) => {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm({
    resolver: zodResolver(CommunityValidation),
    defaultValues: {
      id: community?.id || "",
      bio: community?.bio || "",
      accountId: "",
    },
  });

  const onSubmit = async (data: z.infer<typeof CommunityValidation>) => {
    try {
      await updateCommunityBio(community.id, data.bio);
      setTimeout(() => {
        toast.success("Başarıyla güncellendi");
      }, 1000);
      setIsSubmitting(true);
      router.push(`/${community.id}`);
    } catch (error) {
      console.log(error);
      setIsSubmitting(false);
      toast.error("Bir şeyler ters gitti");
    }
  };
  return (
    <Form {...form}>
      <ToastContainer limit={3} theme={"dark"} autoClose={1500} />
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col justify-start gap-10"
      >
        {/* Hakkında */}
        <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem className="flex flex-col w-full gap-3">
              <FormLabel className="text-base-semibold text-light-2">
                Hakkında
              </FormLabel>
              <FormControl>
                <Textarea
                  rows={10}
                  className="account-form_input no-focus"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Submit */}
        <Button
          type="submit"
          className="bg-primary-500"
          disabled={isSubmitting}
          onClick={() => {
            toast.info("Profilin güncelleniyor");
          }}
        >
          Kaydet
        </Button>
      </form>
    </Form>
  );
};

export default CommunityBioUpdate;
