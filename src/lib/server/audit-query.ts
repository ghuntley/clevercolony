export interface AuditFilterWhereOptions {
	actionType?: string | null;
	conversationId?: string | null;
	conversationQuery?: string | null;
	createdFrom?: number | null;
	createdTo?: number | null;
}

function escapeSqlLike(value: string): string {
	return value.replace(/[\\%_]/g, (token) => `\\${token}`);
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
		const escaped = escapeSqlLike(options.conversationQuery.toLowerCase());
		clauses.push(`LOWER(COALESCE(conversation_id, '')) LIKE ${bindValue(`%${escaped}%`)} ESCAPE '\\'`);
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
