import crypto from "crypto";

export type IProjectItemUpdateField = { text: string } | { number: number } | { singleSelectOptionId: string } | { iterationId: string } | { date: Date }

// TODO: Add select support
const updateProjectItemFieldQuery = (projectId: string, fieldId: string, itemId: string, newValue: IProjectItemUpdateField) => {
	var value = "";
	if ("text" in newValue) value = `{ text: "${newValue.text}"}`;
	else if ("number" in newValue) value = `{ number: ${newValue.number} }`;
	else if ("iterationId" in newValue) value = `{ iterationId: "${newValue.iterationId}" }`;

	return `mutation UpdateProjectV2ItemFieldValue {
		updateProjectV2ItemFieldValue(input: {
			fieldId: "${fieldId}"
			itemId: "${itemId}"
			projectId: "${projectId}"
			clientMutationId: "${crypto.randomUUID()}"
			value: ${value}
		}) {
			clientMutationId
		}
	}`;
}

export type UpdateProjectItemFieldResponse = {
	data: {
		updateProjectV2ItemFieldValue: {
			clientMutationId: string,
		}
	}
}

export default updateProjectItemFieldQuery;
