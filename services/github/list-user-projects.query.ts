export default function(user: string): string {
	const query = `query{
		user(login: "${user}") {
			projectsV2(first: 100) {nodes {id title}}
		}
	}`;

	return query;
}
