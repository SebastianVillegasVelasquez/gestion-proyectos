# Esta es la imagen base en la cual se monta el backend
FROM python:3.13-slim

# Copia del codigo fuente en la imagen
WORKDIR /src

# El RUN se ejecuta mientras la construcción de la imagen, no en el runtime
# Esto instala poetry (porque es el gestor de dependencias del proyecto) en la imagen.
RUN pip install poetry

# Copia los archivos de dependencias y configuración del proyecto
COPY pyproject.toml poetry.lock ./

# Una vez copiados los archivos, crea un entorne virtual en la imagen
# e instala las dependencias
RUN poetry config virtualenvs.create false \
    && poetry install --no-interaction --no-ansi

# Copia todo el codigo fuente
COPY . .

# Expone el puerto 8000 para la imagen
EXPOSE 8000

# Esto es una construccion del comando a la hora del runtime
# del contenedor (ej. uvicorn app.main:app --host 0.0.0.0 --port 8000)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]