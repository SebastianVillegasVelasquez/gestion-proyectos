async def _create_project(client, admin_headers, valid_project_payload) -> str:
    response = await client.post(
        "/api/v1/projects/", json=valid_project_payload, headers=admin_headers
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


async def _create_tipo(client, admin_headers, project_id, nombre, reglas=None) -> str:
    body = {"nombre": nombre}
    if reglas is not None:
        body["reglas_anidacion"] = reglas
    response = await client.post(
        f"/api/v1/projects/{project_id}/node-types", json=body, headers=admin_headers
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


async def _create_item(
    client, admin_headers, project_id, tipo_id, nombre, parent_id=None
) -> dict:
    body = {"tipo_id": tipo_id, "nombre": nombre}
    if parent_id is not None:
        body["parent_id"] = parent_id
    response = await client.post(
        f"/api/v1/projects/{project_id}/work-items", json=body, headers=admin_headers
    )
    assert response.status_code == 201, response.text
    return response.json()


class TestNodeTypeRoutes:
    async def test_requires_authentication(self, client):
        response = await client.get("/api/v1/projects/" + ("0" * 8) + "/node-types")
        assert response.status_code in (401, 403, 422)

    async def test_create_and_list_node_types(
        self, client, admin_headers, valid_project_payload
    ):
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        await _create_tipo(client, admin_headers, project_id, "Programa")
        await _create_tipo(client, admin_headers, project_id, "Curso")

        response = await client.get(
            f"/api/v1/projects/{project_id}/node-types", headers=admin_headers
        )
        assert response.status_code == 200
        nombres = {t["nombre"] for t in response.json()}
        assert {"Programa", "Curso"} <= nombres

    async def test_rejects_duplicate_node_type(
        self, client, admin_headers, valid_project_payload
    ):
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        await _create_tipo(client, admin_headers, project_id, "Fase")
        dup = await client.post(
            f"/api/v1/projects/{project_id}/node-types",
            json={"nombre": "Fase"},
            headers=admin_headers,
        )
        assert dup.status_code == 409


class TestWorkItemTreeRoutes:
    async def test_unicafam_hierarchy(
        self, client, admin_headers, valid_project_payload
    ):
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        t_prog = await _create_tipo(client, admin_headers, project_id, "Programa")
        t_curso = await _create_tipo(client, admin_headers, project_id, "Curso")
        t_mod = await _create_tipo(client, admin_headers, project_id, "Módulo")
        t_fase = await _create_tipo(client, admin_headers, project_id, "Fase")

        prog = await _create_item(client, admin_headers, project_id, t_prog, "Programa")
        curso = await _create_item(
            client, admin_headers, project_id, t_curso, "Curso 1", prog["id"]
        )
        modulo = await _create_item(
            client, admin_headers, project_id, t_mod, "Módulo 1", curso["id"]
        )
        await _create_item(
            client, admin_headers, project_id, t_fase, "Validación", modulo["id"]
        )

        response = await client.get(
            f"/api/v1/projects/{project_id}/work-items", headers=admin_headers
        )
        assert response.status_code == 200
        tree = response.json()
        assert len(tree) == 1
        assert tree[0]["nombre"] == "Programa"
        fase = tree[0]["children"][0]["children"][0]["children"][0]
        assert fase["nombre"] == "Validación"

    async def test_fontur_hierarchy_same_endpoints(
        self, client, admin_headers, valid_project_payload
    ):
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        t_comp = await _create_tipo(client, admin_headers, project_id, "Componente")
        t_act = await _create_tipo(client, admin_headers, project_id, "Actividad")
        comp = await _create_item(
            client, admin_headers, project_id, t_comp, "Componente 1"
        )
        await _create_item(
            client, admin_headers, project_id, t_act, "Frente", comp["id"]
        )

        tree = (
            await client.get(
                f"/api/v1/projects/{project_id}/work-items", headers=admin_headers
            )
        ).json()
        assert tree[0]["children"][0]["nombre"] == "Frente"

    async def test_delete_removes_subtree(
        self, client, admin_headers, valid_project_payload
    ):
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        t = await _create_tipo(client, admin_headers, project_id, "Nodo")
        prog = await _create_item(client, admin_headers, project_id, t, "Programa")
        curso = await _create_item(
            client, admin_headers, project_id, t, "Curso", prog["id"]
        )
        await _create_item(client, admin_headers, project_id, t, "Módulo", curso["id"])

        delete = await client.delete(
            f"/api/v1/work-items/{curso['id']}", headers=admin_headers
        )
        assert delete.status_code == 204

        tree = (
            await client.get(
                f"/api/v1/projects/{project_id}/work-items", headers=admin_headers
            )
        ).json()
        assert len(tree) == 1
        assert tree[0]["children"] == []

    async def test_create_in_unknown_project_404(self, client, admin_headers):
        response = await client.post(
            "/api/v1/projects/00000000-0000-0000-0000-000000000000/work-items",
            json={"tipo_id": "00000000-0000-0000-0000-000000000000", "nombre": "X"},
            headers=admin_headers,
        )
        assert response.status_code == 404


async def _post_item(client, admin_headers, project_id, body) -> dict:
    response = await client.post(
        f"/api/v1/projects/{project_id}/work-items", json=body, headers=admin_headers
    )
    assert response.status_code == 201, response.text
    return response.json()


class TestDateEngineRoutes:
    async def test_inicio_mas_duracion_deriva_fin(
        self, client, admin_headers, valid_project_payload
    ):
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        tipo = await _create_tipo(client, admin_headers, project_id, "Fase")
        item = await _post_item(
            client,
            admin_headers,
            project_id,
            {
                "tipo_id": tipo,
                "nombre": "F1",
                "fecha_inicio_plan": "2026-06-01",
                "duracion_valor": 5,
                "duracion_unidad": "dias",
            },
        )
        assert item["fecha_inicio_plan"] == "2026-06-01"
        assert item["fecha_fin_plan"] == "2026-06-06"

    async def test_solo_duracion_hereda_del_padre(
        self, client, admin_headers, valid_project_payload
    ):
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        tipo = await _create_tipo(client, admin_headers, project_id, "Nodo")
        parent = await _post_item(
            client,
            admin_headers,
            project_id,
            {
                "tipo_id": tipo,
                "nombre": "Padre",
                "fecha_inicio_plan": "2026-07-01",
                "fecha_fin_plan": "2026-07-31",
            },
        )
        child = await _post_item(
            client,
            admin_headers,
            project_id,
            {
                "tipo_id": tipo,
                "nombre": "Hijo",
                "parent_id": parent["id"],
                "duracion_valor": 2,
                "duracion_unidad": "semanas",
            },
        )
        assert child["fecha_inicio_plan"] == "2026-07-01"
        assert child["fecha_fin_plan"] == "2026-07-15"  # 2 semanas = 14 días


class TestDependencyRoutes:
    async def _two(self, client, admin_headers, project_id):
        tipo = await _create_tipo(client, admin_headers, project_id, "Fase")
        pred = await _post_item(
            client,
            admin_headers,
            project_id,
            {
                "tipo_id": tipo,
                "nombre": "Pred",
                "fecha_inicio_plan": "2026-06-01",
                "duracion_valor": 5,
                "duracion_unidad": "dias",
            },
        )
        succ = await _post_item(
            client,
            admin_headers,
            project_id,
            {
                "tipo_id": tipo,
                "nombre": "Succ",
                "duracion_valor": 3,
                "duracion_unidad": "dias",
            },
        )
        return pred, succ

    async def test_dependency_positions_successor(
        self, client, admin_headers, valid_project_payload
    ):
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        pred, succ = await self._two(client, admin_headers, project_id)

        dep = await client.post(
            f"/api/v1/work-items/{succ['id']}/dependencies",
            json={"depends_on_id": pred["id"]},
            headers=admin_headers,
        )
        assert dep.status_code == 201, dep.text

        item = (
            await client.get(f"/api/v1/work-items/{succ['id']}", headers=admin_headers)
        ).json()
        assert item["fecha_inicio_plan"] == "2026-06-07"
        assert item["fecha_fin_plan"] == "2026-06-10"

    async def test_cycle_rejected(self, client, admin_headers, valid_project_payload):
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        pred, succ = await self._two(client, admin_headers, project_id)
        await client.post(
            f"/api/v1/work-items/{succ['id']}/dependencies",
            json={"depends_on_id": pred["id"]},
            headers=admin_headers,
        )
        cycle = await client.post(
            f"/api/v1/work-items/{pred['id']}/dependencies",
            json={"depends_on_id": succ["id"]},
            headers=admin_headers,
        )
        assert cycle.status_code == 422

    async def test_list_and_remove_dependency(
        self, client, admin_headers, valid_project_payload
    ):
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        pred, succ = await self._two(client, admin_headers, project_id)
        await client.post(
            f"/api/v1/work-items/{succ['id']}/dependencies",
            json={"depends_on_id": pred["id"]},
            headers=admin_headers,
        )

        listed = await client.get(
            f"/api/v1/work-items/{succ['id']}/dependencies", headers=admin_headers
        )
        assert listed.status_code == 200
        assert len(listed.json()) == 1

        removed = await client.delete(
            f"/api/v1/work-items/{succ['id']}/dependencies/{pred['id']}",
            headers=admin_headers,
        )
        assert removed.status_code == 204

        # Sin predecesor, "solo duración" vuelve a quedar sin posicionar.
        item = (
            await client.get(f"/api/v1/work-items/{succ['id']}", headers=admin_headers)
        ).json()
        assert item["fecha_inicio_plan"] is None


class TestThirdPartyGate:
    """Al colocar un nodo tipo «Actividad de terceros» bajo un padre, los hijos
    PREVIOS de ese padre pasan a colgar de él y a depender de él."""

    async def _deps(self, client, admin_headers, item_id):
        r = await client.get(
            f"/api/v1/work-items/{item_id}/dependencies", headers=admin_headers
        )
        assert r.status_code == 200, r.text
        return {d["depends_on_id"] for d in r.json()}

    async def _tree(self, client, admin_headers, project_id):
        r = await client.get(
            f"/api/v1/projects/{project_id}/work-items", headers=admin_headers
        )
        assert r.status_code == 200, r.text
        return r.json()

    async def test_create_third_party_reparents_previous_siblings(
        self, client, admin_headers, valid_project_payload
    ):
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        modulo = await _create_tipo(client, admin_headers, project_id, "Módulo")
        tercero = await _create_tipo(
            client, admin_headers, project_id, "Actividad de terceros"
        )
        p = await _create_item(client, admin_headers, project_id, modulo, "P")
        a = await _create_item(client, admin_headers, project_id, modulo, "A", p["id"])
        b = await _create_item(client, admin_headers, project_id, modulo, "B", p["id"])

        n = await _create_item(
            client, admin_headers, project_id, tercero, "Tercero", p["id"]
        )

        tree = await self._tree(client, admin_headers, project_id)
        p_node = next(x for x in tree if x["id"] == p["id"])
        assert [c["id"] for c in p_node["children"]] == [n["id"]]
        n_node = p_node["children"][0]
        assert {c["id"] for c in n_node["children"]} == {a["id"], b["id"]}

        assert await self._deps(client, admin_headers, a["id"]) == {n["id"]}
        assert await self._deps(client, admin_headers, b["id"]) == {n["id"]}

    async def test_move_third_party_reparents_and_ignores_later_children(
        self, client, admin_headers, valid_project_payload
    ):
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        modulo = await _create_tipo(client, admin_headers, project_id, "Módulo")
        tercero = await _create_tipo(
            client, admin_headers, project_id, "Actividad de terceros"
        )
        p = await _create_item(client, admin_headers, project_id, modulo, "P")
        a = await _create_item(client, admin_headers, project_id, modulo, "A", p["id"])
        n = await _create_item(client, admin_headers, project_id, tercero, "Tercero")

        moved = await client.post(
            f"/api/v1/work-items/{n['id']}/move",
            json={"new_parent_id": p["id"]},
            headers=admin_headers,
        )
        assert moved.status_code == 200, moved.text

        assert await self._deps(client, admin_headers, a["id"]) == {n["id"]}

        # Un hijo añadido a P DESPUÉS no se toca.
        c = await _create_item(client, admin_headers, project_id, modulo, "C", p["id"])
        tree = await self._tree(client, admin_headers, project_id)
        p_node = next(x for x in tree if x["id"] == p["id"])
        child_ids = {x["id"] for x in p_node["children"]}
        assert c["id"] in child_ids and n["id"] in child_ids
        assert await self._deps(client, admin_headers, c["id"]) == set()
