const { z } = require('zod');

const technicianCheckInSchema = z.object({
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  evidenceKey: z.string().optional()
});

const technicianNoteSchema = z.object({
  text: z.string().min(1, 'Note text is required')
});

const technicianAttachmentSchema = z.object({
  type: z.enum(['before', 'after']),
  url: z.string().min(1, 'Photo URL or storage key is required'),
  caption: z.string().optional()
});

const technicianHoldSchema = z.object({
  reason: z.string().min(1, 'Hold reason is required'),
  materialRequests: z.array(
    z.object({
      itemId: z.string().optional(),
      name: z.string().min(1, 'Material name is required'),
      quantity: z.number().default(1)
    })
  ).optional()
});

const technicianCompleteSchema = z.object({
  completionNote: z.string().optional(),
  afterPhotos: z.array(
    z.object({
      url: z.string().min(1, 'Photo URL is required'),
      caption: z.string().optional()
    })
  ).optional()
});

module.exports = {
  technicianCheckInSchema,
  technicianNoteSchema,
  technicianAttachmentSchema,
  technicianHoldSchema,
  technicianCompleteSchema
};

