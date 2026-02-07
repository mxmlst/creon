export const logHeader = (log: (message: string) => void, title: string) => {
  log(`[DEBUG] ${title}`);
};

export const logFooter = (log: (message: string) => void, title?: string) => {
  if (title) {
    log(`[DEBUG] ${title}`);
  }
};

export const logStep = (
  log: (message: string) => void,
  step: number,
  message: string,
  data?: Record<string, unknown>
) => {
  log(`[DEBUG] Step ${step}: ${message}`);
  if (data && Object.keys(data).length > 0) {
    log(`[DEBUG] Step ${step} data: ${JSON.stringify(data)}`);
  }
};

export const logError = (log: (message: string) => void, message: string) => {
  log(`[DEBUG] ERROR: ${message}`);
};
