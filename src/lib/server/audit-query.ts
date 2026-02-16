export interface AuditFilterWhereOptions {
	actionType?: string | null;
	conversationId?: string | null;
	conversationQuery?: string | null;
	createdFrom?: number | null;
	createdTo?: number | null;
}

export function buildAuditFilterWhere(options: AuditFilterWhereOptions) {
	const clauses: string[] = [];
	const bindings: Array<string | number> = [];
	const bindValue = (value: string | number) => {
		bindings.push(value);
		return `?${bindings.length}`;
	};

	if (options.actionType) {
		clauses.push(`action_type = ${bindValue(options.actionType)}`);
	}
	if (options.conversationId) {
		clauses.push(`conversation_id = ${bindValue(options.conversationId)}`);
	}
	if (options.conversationQuery) {
		clauses.push(`LOWER(COALESCE(conversation_id, '')) LIKE ${bindValue(`%${options.conversationQuery.toLowerCase()}%`)}`);
	}
	if (options.createdFrom !== null && options.createdFrom !== undefined) {
		clauses.push(`created_at >= ${bindValue(options.createdFrom)}`);
	}
	if (options.createdTo !== null && options.createdTo !== undefined) {
		clauses.push(`created_at <= ${bindValue(options.createdTo)}`);
	}

	return {
		whereClause: clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '',
		bindings
	};
}
