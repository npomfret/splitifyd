import { getAppBuilder } from '../ApplicationBuilderSingleton';
import { SettlementHandlers } from './SettlementHandlers';

const settlentHandlers = SettlementHandlers.createSettlementHandlers(getAppBuilder());

export const createSettlement = settlentHandlers.createSettlement;
export const updateSettlement = settlentHandlers.updateSettlement;
export const deleteSettlement = settlentHandlers.deleteSettlement;
