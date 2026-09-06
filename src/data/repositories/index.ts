import { DocumentRepository } from './DocumentRepository';
import { StatisticsRepository } from './StatisticsRepository';
import { SettingsRepository } from './SettingsRepository';

export const documentRepo = new DocumentRepository();
export const statisticsRepo = new StatisticsRepository();
export const settingsRepo = new SettingsRepository();
