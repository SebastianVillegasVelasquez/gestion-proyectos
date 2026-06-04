class TestCreateProject:
    async def test_create_project(self, client):
        response = await client.post("/api/v1/projects/",
                                     json={
                                         "name": "Test Project",
                                         "description": "This is a test project",
                                         "client_name": "Test Client",
                                         "coordinator_id": 1,
                                     })

        return None
