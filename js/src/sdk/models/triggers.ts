
import { TriggerData, PusherUtils } from "../utils/pusher";
import logger from "../../utils/logger";
import {BackendClient} from "./backendClient"

import apiClient from "../client/client"

import { CEG } from "../utils/error";
import { ListTriggersData } from "../client";

type RequiredQuery = ListTriggersData["query"];

export class Triggers {
    trigger_to_client_event = "trigger_to_client";

    backendClient: BackendClient;
    constructor(backendClient: BackendClient) {
        this.backendClient = backendClient;
    }

    /**
     * Retrieves a list of all triggers in the Composio platform.
     * 
     * This method allows you to fetch a list of all the available triggers. It supports pagination to handle large numbers of triggers. The response includes an array of trigger objects, each containing information such as the trigger's name, description, input parameters, expected response, associated app information, and enabled status.
     * 
     * @param {ListTriggersData} data The data for the request.
     * @returns {CancelablePromise<ListTriggersResponse>} A promise that resolves to the list of all triggers.
     * @throws {ApiError} If the request fails.
     */
    async list(data: RequiredQuery={} ) {
        try {
            const {data:response} = await apiClient.triggers.listTriggers({
                query: {
                    appNames: data?.appNames,
                }
            });
            return response || [];
        } catch (error) {
            throw CEG.handleError(error);
        }
    }

    /**
     * Setup a trigger for a connected account.
     * 
     * @param {SetupTriggerData} data The data for the request.
     * @returns {CancelablePromise<SetupTriggerResponse>} A promise that resolves to the setup trigger response.
     * @throws {ApiError} If the request fails.
     */
    async setup(connectedAccountId: string, triggerName: string, config: Record<string, any>): Promise<{status: string, triggerId: string}> {
        try {
            const response = await apiClient.triggers.enableTrigger({
                path: {
                    connectedAccountId,
                    triggerName
                },
                body: {
                    triggerConfig: config
                }
            });
            return response.data as {status: string, triggerId: string};
        } catch (error) {
            throw CEG.handleError(error);
        }
    }

    async enable(data: { triggerId: string }) {
        try {
            const response = await apiClient.triggers.switchTriggerInstanceStatus({
                path: data,
                body: {
                    enabled: true
                }
            });
            return {
                status: "success"
            }
        } catch (error) {
            throw CEG.handleError(error);
        }
    }

    async disable(data: { triggerId: string }) {
        try {
            const response = await apiClient.triggers.switchTriggerInstanceStatus({
                path: data,
                body: {
                    enabled: false
                }
            });
            return {
                status: "success"
            }
        } catch (error) {
            throw CEG.handleError(error);
        }
    }

    async delete(data: { triggerInstanceId: string }) {
        try {
            const response = await apiClient.triggers.deleteTrigger({
                path: data
            });
            return {
                status: "success"
            }
        } catch (error) {
            throw CEG.handleError(error);
        }
    }

    async subscribe(fn: (data: TriggerData) => void, filters:{
        appName?: string,
        triggerId?  : string;
        connectionId?: string;
        integrationId?: string;
        triggerName?: string;
        triggerData?: string;
        entityId?: string;
    }={}) {

        if(!fn) throw new Error("Function is required for trigger subscription");
        //@ts-ignore
        const clientId = await this.backendClient.getClientId();
        //@ts-ignore
        await PusherUtils.getPusherClient(this.backendClient.baseUrl, this.backendClient.apiKey);

        const shouldSendTrigger = (data: TriggerData) => {
           if(Object.keys(filters).length === 0) return true;
            else{
                return (
                    (!filters.appName || data.appName === filters.appName) &&
                    (!filters.triggerId || data.metadata.id === filters.triggerId) &&
                    (!filters.connectionId || data.metadata.connectionId === filters.connectionId) &&
                    (!filters.triggerName || data.metadata.triggerName === filters.triggerName) &&
                    (!filters.entityId || data.metadata.connection.clientUniqueUserId === filters.entityId) &&
                    (!filters.integrationId || data.metadata.connection.integrationId === filters.integrationId)
                );
            }
        }
        
        logger.info("Subscribing to triggers",filters)
        PusherUtils.triggerSubscribe(clientId, (data: TriggerData) => {
            if (shouldSendTrigger(data)) {
                fn(data);
            }
        });
    }

    async unsubscribe() {
        //@ts-ignore
        const clientId = await this.backendClient.getClientId();
        PusherUtils.triggerUnsubscribe(clientId);
    }
}

