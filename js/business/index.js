// ====================== 业务模块统一导出 ======================

import { core } from './core.js';
import { analysis } from './analysis.js';
import { prediction } from './prediction.js';
import { profile } from './profile.js';
import { record } from './record.js';
import { mlPredict } from './ml-predict.js';

export const Business = {
  ...core,
  ...analysis,
  ...prediction,
  ...profile,
  record,
  ...mlPredict,
};
