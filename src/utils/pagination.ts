import { Model, PipelineStage } from "mongoose";

export const paginateAggregate = async <T>(
  model: Model<any>,
  pipeline: PipelineStage[],
  page: number = 1,
  limit: number = 10
): Promise<{ data: T[]; count: number }> => {
  const skip = (page - 1) * limit;

  const facetPipeline: PipelineStage[] = [
    ...pipeline,
    {
      $facet: {
        metadata: [{ $count: "total" }],
        data: [{ $skip: skip }, { $limit: limit }],
      },
    },
    {
      $project: {
        count: { $arrayElemAt: ["$metadata.total", 0] },
        data: 1,
      },
    },
  ];

  const result = await model.aggregate(facetPipeline);

  return {
    data: result[0]?.data || [],
    count: result[0]?.count || 0,
  };
};
