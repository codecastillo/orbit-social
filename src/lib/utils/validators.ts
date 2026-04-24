import { z } from "zod";

const RESERVED_USERNAMES = [
  "login", "signup", "feed", "callback", "onboarding", "api", "admin",
  "settings", "explore", "reels", "messages", "notifications", "communities",
  "marketplace", "events", "bookmarks", "profile", "post", "search",
  "help", "about", "terms", "privacy", "support", "null", "undefined",
];

export const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(30, "Username must be 30 characters or less")
  .regex(
    /^[a-zA-Z0-9_]+$/,
    "Username can only contain letters, numbers, and underscores"
  )
  .refine(
    (username) => !RESERVED_USERNAMES.includes(username.toLowerCase()),
    "This username is reserved"
  );

export const displayNameSchema = z
  .string()
  .min(1, "Display name is required")
  .max(50, "Display name must be 50 characters or less")
  .refine(
    (name) => !/[\p{Cc}\p{Cn}]/gu.test(name),
    "Display name contains invalid characters"
  );

export const bioSchema = z
  .string()
  .max(160, "Bio must be 160 characters or less")
  .optional();

export const websiteSchema = z
  .string()
  .url("Must be a valid URL")
  .refine(
    (url) => {
      try {
        const parsed = new URL(url);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    },
    "URL must start with http:// or https://"
  )
  .optional()
  .or(z.literal(""));

export const signUpSchema = z
  .object({
    email: z.string().email("Invalid email address"),
    password: z
      .string()
      .min(10, "Password must be at least 10 characters")
      .regex(/[A-Z]/, "Must contain at least one uppercase letter")
      .regex(/[a-z]/, "Must contain at least one lowercase letter")
      .regex(/[0-9]/, "Must contain at least one number")
      .regex(
        /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/,
        "Must contain at least one special character"
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const onboardingSchema = z.object({
  username: usernameSchema,
  displayName: displayNameSchema,
  bio: bioSchema,
  website: websiteSchema,
});

export const fullSignUpSchema = z
  .object({
    fullName: z
      .string()
      .min(1, "Full name is required")
      .max(50, "Full name must be 50 characters or less")
      .refine(
        (name) => !/[\p{Cc}\p{Cn}]/gu.test(name),
        "Name contains invalid characters"
      ),
    username: usernameSchema,
    email: z.string().email("Invalid email address"),
    dateOfBirth: z
      .string()
      .min(1, "Date of birth is required")
      .refine(
        (dob) => {
          const birth = new Date(dob);
          const today = new Date();
          let age = today.getFullYear() - birth.getFullYear();
          const monthDiff = today.getMonth() - birth.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
          }
          return age >= 13;
        },
        "You must be at least 13 years old"
      ),
    password: z
      .string()
      .min(10, "Password must be at least 10 characters")
      .regex(/[A-Z]/, "Must contain at least one uppercase letter")
      .regex(/[a-z]/, "Must contain at least one lowercase letter")
      .regex(/[0-9]/, "Must contain at least one number")
      .regex(
        /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/,
        "Must contain at least one special character"
      ),
    confirmPassword: z.string(),
    bio: z.string().max(160, "Bio must be 160 characters or less").optional().or(z.literal("")),
    agreeToTerms: z.boolean().refine((val) => val === true, "You must agree to the terms"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export const postSchema = z.object({
  content: z
    .string()
    .min(1, "Post cannot be empty")
    .max(500, "Post must be 500 characters or less"),
});

export type FullSignUpFormData = z.infer<typeof fullSignUpSchema>;
export type SignUpFormData = z.infer<typeof signUpSchema>;
export type LoginFormData = z.infer<typeof loginSchema>;
export type OnboardingFormData = z.infer<typeof onboardingSchema>;
export type PostFormData = z.infer<typeof postSchema>;
