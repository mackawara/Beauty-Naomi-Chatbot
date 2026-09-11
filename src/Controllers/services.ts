import { Service } from "../models/Services";
import { logger } from "../services/logger";
import { createService } from "../services/calBooking.service";

interface ServiceHandlerFeilds {
  serviceName: string;
  productRetailerId?: string;
  catalogId?: string;
  price?: number;
  duration: number;
  eventTypeId: string;
}

export const serviceHandler = async (serviceData: ServiceHandlerFeilds) => {
  try {
    const calServiceData = await createService(
      serviceData.serviceName,
      serviceData.duration,
    );

    if (!calServiceData.success || !calServiceData.data) {
      logger.error(
        `Failed to create service in Cal.com: ${calServiceData.error}`,
      );
      return;
    }

    const eventTypeId = calServiceData.data?.eventTypeId;
    const existingService = await Service.find()
      .where({
        eventTypeId: serviceData.eventTypeId,
        serviceName: serviceData.serviceName,
      })
      .exec();
    if (existingService.length > 0) {
      logger.info(
        `Service ${serviceData.serviceName} with eventTypeId ${serviceData.eventTypeId} already exists. Skipping creation.`,
      );
      return;
    }
    logger.info(
      `Creating service for ${serviceData.serviceName}`,
    );
    const service = new Service({
      serviceName: serviceData.serviceName,
      productRetailerId: serviceData.productRetailerId,
      catalogId: serviceData.catalogId,
      price: serviceData.price,
      duration: serviceData.duration,
      eventTypeId,
    });

    await service.save();

    logger.info(
      `Service ${serviceData.serviceName} created successfully`,
    );
  } catch (error) {
    logger.error(
      `Error creating service: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

export function extractAndConvertToMinutes(description: string): number | null {
  // Extract text between = and |
  const match = description.match(/=\s*(.*?)\s*\|/);
  if (!match) return null;

  const timeString = match[1].trim();
  return convertToMinutes(timeString);
}

function convertToMinutes(timeString: string): number {
  let totalMinutes: number = 0;

  // Extract hours (numbers followed by 'hr' or 'h')
  const hoursMatch = timeString.match(/(\d+(?:\.\d+)?)\s*(?:hr|hour|h)/i);
  if (hoursMatch) {
    totalMinutes += parseFloat(hoursMatch[1]) * 60;
  }

  // Extract minutes (numbers followed by 'mins' or 'm)
  const minutesMatch = timeString.match(/(\d+(?:\.\d+)?)\s*(?:min|minute|m)/i);
  if (minutesMatch) {
    totalMinutes += parseFloat(minutesMatch[1]);
  }

  return totalMinutes;
}

export const itemDescriptions = {
  pedicureAndGel: "Pedicure [foot scrub] and gel = 2h | R 350",
  polygelOnNaturalNails: "Polygel on natural nails plain = 2h | R 250",
  manicureMen: "Manicure for Men = 45mins | R 100",
  acrylicFrench: "Acrylic french short tips hands = 2h | R 300",
  soakOff: "Soak Off = 30mins | R 50",
  getOnToes: "Get on toes = 1h | R150",
  shortFullSetAcrylic: "Short full set acrylic = 1h | R 250",
  mediumFullSetAcrylic:
    "Meduim full set acrylic french or any gel colour = 2h 30mins | R 350",
  longFullSetAcrylic:
    "Long full set acrylic French or with gel polish = 2h 30mins | R 450",
  soakOffAndGellToes: "Soak off and gel toes = 1h | 200 R",
  soakOffAndPolygel: "Soak off And polygel overlay hands = 2h | R 300",
  polygelOverlayFrench: "Polygel Overlay french = 2h | R300",
  getOnToesFrench: "Get on toes french = 1h | R 200",
  pedicureForMen: "Pedicure for men = 1h | R 250",
};
