import { z } from "zod";

export const bitbucketLinkSchema = z.object({
  href: z.string().url(),
});

export const bitbucketUserSchema = z.object({
  uuid: z.string(),
  nickname: z.string().optional().nullable(),
  display_name: z.string().optional().nullable(),
  links: z
    .object({
      avatar: bitbucketLinkSchema.optional(),
    })
    .optional()
    .nullable(),
});

export const bitbucketRepoSchema = z.object({
  slug: z.string(),
  name: z.string(),
});

export const bitbucketPaginatedSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    values: z.array(item),
    next: z.string().url().optional(),
  });

export const bitbucketWorkspaceRepoListSchema = bitbucketPaginatedSchema(
  bitbucketRepoSchema,
);

export const bitbucketWorkspaceMemberSchema = z.object({
  user: bitbucketUserSchema,
});

export const bitbucketWorkspaceMembersSchema = bitbucketPaginatedSchema(
  bitbucketWorkspaceMemberSchema,
);

export const bitbucketParticipantSchema = z.object({
  user: bitbucketUserSchema,
  approved: z.boolean().optional().nullable(),
  state: z.string().optional().nullable(),
  role: z.string().optional().nullable(),
});

export const bitbucketPullRequestSchema = z.object({
  id: z.number(),
  title: z.string(),
  links: z.object({
    html: bitbucketLinkSchema,
  }),
  author: bitbucketUserSchema,
  created_on: z.string(),
  updated_on: z.string().optional().nullable(),
  participants: z.array(bitbucketParticipantSchema).optional().nullable(),
});

export const bitbucketPullRequestListSchema = bitbucketPaginatedSchema(
  bitbucketPullRequestSchema,
);

export type BitbucketRepo = z.infer<typeof bitbucketRepoSchema>;
export type BitbucketUser = z.infer<typeof bitbucketUserSchema>;
export type BitbucketPullRequest = z.infer<typeof bitbucketPullRequestSchema>;

