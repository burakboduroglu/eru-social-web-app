"use client";

// Shadcn UI
import {
  Form,
  FormControl,
  FormLabel,
  FormMessage,
  FormField,
  FormItem,
} from "../ui/form";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";

// About Zod
import { zodResolver } from "@hookform/resolvers/zod";
import { UserValidation } from "@/lib/validations/user";
import * as z from "zod";

import Image from "next/image";

// React
import { ChangeEvent, useState } from "react";
import { useForm } from "react-hook-form";

// Utils
import { isBase64Image } from "@/lib/utils";
import { useUploadThing } from "@/lib/uploadthing";

// Actions
import { updateUser } from "@/lib/actions/user.actions";

// Next
import { usePathname, useRouter } from "next/navigation";

import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

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

export default function AccountProfile({ user }: Readonly<Props>) {
  const [files, setFiles] = useState<File[]>([]);
  const { startUpload } = useUploadThing("imageUploader");
  const router = useRouter();
  const pathname = usePathname();

  const form = useForm({
    resolver: zodResolver(UserValidation), // use for validation with Zod
    defaultValues: {
      profile_photo: user?.image || "",
      name: user?.name || "",
      username: user?.username || "",
      bio: user?.bio || "",
    },
  });

  // Image update or upload
  const handleImage = (
    e: ChangeEvent<HTMLInputElement>,
    fieldChange: (value: string) => void
  ) => {
    e.preventDefault();
    const fileReader = new FileReader();
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];

      setFiles(Array.from(e.target.files));

      if (!file.type.includes("image")) return;

      fileReader.onload = async (e) => {
        const imageDataUrl = e?.target?.result?.toString() ?? "";
        fieldChange(imageDataUrl);
      };

      fileReader.readAsDataURL(file);
    }
  };

  // Form submit
  const onSubmit = async (values: z.infer<typeof UserValidation>) => {
    try {
      const blob = values.profile_photo;
      const hasImageChanged = isBase64Image(blob);
      if (hasImageChanged) {
        const imageResponse = await startUpload(files);
        if (imageResponse && imageResponse[0].url) {
          values.profile_photo = imageResponse[0].url;
        }
      }
      await updateUser({
        userId: user.id,
        username: values.username,
        name: values.name,
        bio: values.bio,
        image: values.profile_photo,
        path: pathname,
      });

      if (pathname === "/profile/edit") {
        router.back();
      } else {
        router.push(`profile/${user.id}`);
      }
    } catch (error) {
      console.log(error);
      showToastMessage();
    }
  };

  const showToastMessage = () => {
    toast.error("İşleminiz gerçekleştirilemedi!", {
      position: toast.POSITION.TOP_RIGHT,
    });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col justify-start gap-10"
      >
        {/* For Profile Photo */}
        <FormField
          control={form.control}
          name="profile_photo"
          render={({ field }) => (
            <FormItem className="flex items-center gap-5">
              <FormLabel className="account-form_image-label">
                {field.value ? (
                  <Image
                    src={field.value}
                    alt="profile-photo"
                    width={96}
                    height={96}
                    priority
                    className="rounded-full object-contain"
                  />
                ) : (
                  <Image
                    src="/assets/profile.svg"
                    alt="profile-photo"
                    width={24}
                    height={24}
                    className="object-contain"
                  />
                )}
              </FormLabel>
              <FormControl className="flex-1 text-base-semibold text-gray-200">
                <Input
                  type="file"
                  accept="image/*"
                  placeholder="Resim yükle"
                  className="account-form_image-input"
                  onChange={(e) => handleImage(e, field.onChange)}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {/* For Name */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="flex flex-col gap-3 w-full">
              <FormLabel className="text-base-semibold text-light-2 pl-1">
                İsminiz
              </FormLabel>
              <FormControl>
                <Input
                  type="text"
                  className="account-form_input no-focus"
                  {...field}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {/* For Username */}
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem className="flex flex-col gap-3 w-full">
              <FormLabel className="text-base-semibold text-light-2 pl-1">
                Kullanıcı Adınız
              </FormLabel>
              <FormControl>
                <Input
                  type="text"
                  className="account-form_input no-focus"
                  {...field}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {/* For Bio */}
        <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem className="flex flex-col gap-3 w-full">
              <FormLabel className="text-base-semibold text-light-2 pl-1">
                Profil açıklamanızı girin
              </FormLabel>
              <FormControl>
                <Textarea
                  rows={5}
                  className="account-form_input no-focus"
                  {...field}
                  placeholder="Bir şeyler yazın..."
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="bg-primary-500">
          Kaydet
        </Button>
      </form>
      <ToastContainer limit={3} theme={"dark"} autoClose={1500} />
    </Form>
  );
}
