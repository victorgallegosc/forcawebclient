import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { DRIVERS, type Driver } from "./rotation";
import { fetchDriverRoutePlan, type DriverRoutePlan } from "./maps";

const driverSchema = z.enum(DRIVERS);

export const getDriverRouteFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ driver: driverSchema }).parse(data),
  )
  .handler(async ({ data }): Promise<DriverRoutePlan> => {
    return fetchDriverRoutePlan(data.driver as Driver);
  });
