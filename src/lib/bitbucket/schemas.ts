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
  uuid: z.string(),
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

const bitbucketBranchRefSchema = z
  .object({ branch: z.object({ name: z.string() }).optional().nullable() })
  .optional()
  .nullable();

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
  reviewers: z.array(bitbucketUserSchema).optional().nullable(),
  comment_count: z.number().optional().nullable(),
  task_count: z.number().optional().nullable(),
  source: bitbucketBranchRefSchema,
  destination: bitbucketBranchRefSchema,
});

export const bitbucketPullRequestDetailSchema = z.object({
  id: z.number(),
  title: z.string(),
  updated_on: z.string().optional().nullable(),
  summary: z.object({ raw: z.string().optional().nullable() }).optional().nullable(),
  reviewers: z.array(z.object({ uuid: z.string() })).optional().nullable(),
});

export const bitbucketDiffstatSchema = z.object({
  lines_added: z.number().optional().nullable(),
  lines_removed: z.number().optional().nullable(),
});

export const bitbucketCommitStatusSchema = z.object({
  state: z.string(),
  name: z.string().optional().nullable(),
  url: z.string().optional().nullable(),
});

export const bitbucketCommentSchema = z.object({
  id: z.number(),
  created_on: z.string(),
  deleted: z.boolean().optional().nullable(),
  content: z.object({ raw: z.string().optional().nullable() }).optional().nullable(),
  user: bitbucketUserSchema.optional().nullable(),
  inline: z.object({ path: z.string().optional().nullable() }).optional().nullable(),
});

export const bitbucketCommentPageSchema = bitbucketPaginatedSchema(bitbucketCommentSchema);

export const bitbucketPullRequestListSchema = bitbucketPaginatedSchema(
  bitbucketPullRequestSchema,
);

export type BitbucketRepo = z.infer<typeof bitbucketRepoSchema>;
export type BitbucketUser = z.infer<typeof bitbucketUserSchema>;
export type BitbucketPullRequest = z.infer<typeof bitbucketPullRequestSchema>;
export type BitbucketPullRequestDetail = z.infer<typeof bitbucketPullRequestDetailSchema>;
export type BitbucketComment = z.infer<typeof bitbucketCommentSchema>;

