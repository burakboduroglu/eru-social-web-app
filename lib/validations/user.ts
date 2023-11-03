import { z } from "zod";

export const UserValidation = z.object({
  profile_photo: z
    .string()
    .url()
    .refine((value) => value.length > 0, {
      message: "Profil fotoğrafı URL'si en az 1 karakter olmalıdır",
    }),
  name: z
    .string()
    .min(3, {
      message: "Ad en az 3 karakter olmalıdır",
    })
    .max(30, {
      message: "Ad en fazla 30 karakter olmalıdır",
    }),
  username: z
    .string()
    .min(3, {
      message: "Kullanıcı adı en az 3 karakter olmalıdır",
    })
    .max(30, {
      message: "Kullanıcı adı en fazla 30 karakter olmalıdır",
    }),
  bio: z
    .string()
    .min(3, {
      message: "Biyografi en az 3 karakter olmalıdır",
    })
    .max(1000, {
      message: "Biyografi en fazla 1000 karakter olmalıdır",
    }),
});
