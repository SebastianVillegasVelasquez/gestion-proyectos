"""`AddVersionRequest`: la URL es obligatoria salvo en las entregas
"sin adjunto", donde se normaliza a `None`."""

import pytest
from pydantic import ValidationError

from app.modules.teams.infrastructure.workspace_enums import ResourceType
from app.modules.teams.presentation.workspace_schemas import AddVersionRequest


class TestAddVersionRequestUrlRules:
    def test_url_required_for_a_normal_resource(self):
        with pytest.raises(ValidationError):
            AddVersionRequest(type=ResourceType.ENLACE)
        with pytest.raises(ValidationError):
            AddVersionRequest(type=ResourceType.ENLACE, url="   ")

    def test_url_kept_for_a_normal_resource(self):
        v = AddVersionRequest(type=ResourceType.ENLACE, url="https://x.dev/a")
        assert v.url == "https://x.dev/a"

    def test_sin_adjunto_needs_no_url_and_is_normalised_to_none(self):
        v = AddVersionRequest(type=ResourceType.SIN_ADJUNTO)
        assert v.url is None

    def test_sin_adjunto_ignores_any_url_sent(self):
        v = AddVersionRequest(type=ResourceType.SIN_ADJUNTO, url="https://ignored")
        assert v.url is None
