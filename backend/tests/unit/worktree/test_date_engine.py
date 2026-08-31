import datetime

from app.modules.project.structure.domain.date_engine import (
    derive_dates,
    duration_in_days,
    viola_fts,
)
from app.modules.project.structure.infrastructure.enums import DuracionUnidad

D = datetime.date


def _derive(**kwargs):
    base = dict(
        fecha_inicio_plan=None,
        fecha_fin_plan=None,
        duracion_valor=None,
        duracion_unidad=None,
    )
    base.update(kwargs)
    return derive_dates(**base)


class TestDurationInDays:
    def test_dias(self):
        assert duration_in_days(5, DuracionUnidad.DIAS) == 5

    def test_semanas(self):
        assert duration_in_days(2, DuracionUnidad.SEMANAS) == 14

    def test_none_when_incomplete(self):
        assert duration_in_days(None, DuracionUnidad.DIAS) is None
        assert duration_in_days(5, None) is None


class TestDeriveDates:
    def test_modo1_inicio_mas_duracion(self):
        out = _derive(
            fecha_inicio_plan=D(2026, 6, 1),
            duracion_valor=5,
            duracion_unidad=DuracionUnidad.DIAS,
        )
        assert out.fecha_inicio_plan == D(2026, 6, 1)
        assert out.fecha_fin_plan == D(2026, 6, 6)
        assert out.advertencia is False

    def test_modo1_en_semanas(self):
        out = _derive(
            fecha_inicio_plan=D(2026, 6, 1),
            duracion_valor=2,
            duracion_unidad=DuracionUnidad.SEMANAS,
        )
        assert out.fecha_fin_plan == D(2026, 6, 15)

    def test_modo2_fin_mas_duracion(self):
        out = _derive(
            fecha_fin_plan=D(2026, 6, 10),
            duracion_valor=4,
            duracion_unidad=DuracionUnidad.DIAS,
        )
        assert out.fecha_inicio_plan == D(2026, 6, 6)
        assert out.fecha_fin_plan == D(2026, 6, 10)

    def test_modo3_solo_duracion_hereda_de_predecesor(self):
        out = _derive(
            duracion_valor=3,
            duracion_unidad=DuracionUnidad.DIAS,
            predecessor_end=D(2026, 6, 10),
        )
        # Empieza al día siguiente del fin del predecesor (FtS).
        assert out.fecha_inicio_plan == D(2026, 6, 11)
        assert out.fecha_fin_plan == D(2026, 6, 14)

    def test_modo3_solo_duracion_hereda_del_padre_si_no_hay_predecesor(self):
        out = _derive(
            duracion_valor=3,
            duracion_unidad=DuracionUnidad.DIAS,
            parent_start=D(2026, 7, 1),
        )
        assert out.fecha_inicio_plan == D(2026, 7, 1)
        assert out.fecha_fin_plan == D(2026, 7, 4)

    def test_modo3_predecesor_tiene_prioridad_sobre_padre(self):
        out = _derive(
            duracion_valor=2,
            duracion_unidad=DuracionUnidad.DIAS,
            predecessor_end=D(2026, 6, 20),
            parent_start=D(2026, 6, 1),
        )
        assert out.fecha_inicio_plan == D(2026, 6, 21)

    def test_modo3_sin_contexto_queda_sin_posicionar(self):
        out = _derive(duracion_valor=3, duracion_unidad=DuracionUnidad.DIAS)
        assert out.fecha_inicio_plan is None
        assert out.fecha_fin_plan is None

    def test_par_fecha_fecha_prevalece_sin_duracion(self):
        out = _derive(fecha_inicio_plan=D(2026, 6, 1), fecha_fin_plan=D(2026, 6, 30))
        assert out.fecha_inicio_plan == D(2026, 6, 1)
        assert out.fecha_fin_plan == D(2026, 6, 30)
        assert out.advertencia is False

    def test_tres_valores_inconsistentes_marca_advertencia(self):
        out = _derive(
            fecha_inicio_plan=D(2026, 6, 1),
            fecha_fin_plan=D(2026, 6, 30),
            duracion_valor=5,
            duracion_unidad=DuracionUnidad.DIAS,
        )
        # Prevalece el par de fechas, pero la duración (5d) no cuadra → advertencia.
        assert out.fecha_inicio_plan == D(2026, 6, 1)
        assert out.fecha_fin_plan == D(2026, 6, 30)
        assert out.advertencia is True

    def test_tres_valores_coherentes_sin_advertencia(self):
        out = _derive(
            fecha_inicio_plan=D(2026, 6, 1),
            fecha_fin_plan=D(2026, 6, 6),
            duracion_valor=5,
            duracion_unidad=DuracionUnidad.DIAS,
        )
        assert out.advertencia is False

    def test_incompletos_se_devuelven_tal_cual(self):
        out = _derive(fecha_inicio_plan=D(2026, 6, 1))
        assert out.fecha_inicio_plan == D(2026, 6, 1)
        assert out.fecha_fin_plan is None

    def test_solo_fin_sin_duracion_ancla_inicio_al_inicio_del_proyecto(self):
        out = _derive(
            fecha_fin_plan=D(2026, 6, 10),
            project_start=D(2026, 1, 1),
            project_end=D(2026, 12, 31),
        )
        assert out.fecha_inicio_plan == D(2026, 1, 1)
        assert out.fecha_fin_plan == D(2026, 6, 10)
        assert out.advertencia is False

    def test_solo_inicio_sin_duracion_ancla_fin_al_fin_del_proyecto(self):
        out = _derive(
            fecha_inicio_plan=D(2026, 6, 1),
            project_start=D(2026, 1, 1),
            project_end=D(2026, 12, 31),
        )
        assert out.fecha_inicio_plan == D(2026, 6, 1)
        assert out.fecha_fin_plan == D(2026, 12, 31)

    def test_una_fecha_sin_borde_de_proyecto_queda_tal_cual(self):
        out = _derive(fecha_fin_plan=D(2026, 6, 10))
        assert out.fecha_inicio_plan is None
        assert out.fecha_fin_plan == D(2026, 6, 10)

    def test_duracion_explicita_tiene_prioridad_sobre_el_borde_del_proyecto(self):
        out = _derive(
            fecha_fin_plan=D(2026, 6, 10),
            duracion_valor=4,
            duracion_unidad=DuracionUnidad.DIAS,
            project_start=D(2026, 1, 1),
        )
        # Con duración se usa el Modo 2 (fin - duración), no el inicio del proyecto.
        assert out.fecha_inicio_plan == D(2026, 6, 6)


class TestViolaFts:
    def test_inicio_antes_o_igual_al_fin_del_predecesor(self):
        assert viola_fts(D(2026, 6, 10), D(2026, 6, 10)) is True
        assert viola_fts(D(2026, 6, 9), D(2026, 6, 10)) is True

    def test_inicio_despues_no_viola(self):
        assert viola_fts(D(2026, 6, 11), D(2026, 6, 10)) is False

    def test_sin_datos_no_viola(self):
        assert viola_fts(None, D(2026, 6, 10)) is False
        assert viola_fts(D(2026, 6, 10), None) is False
