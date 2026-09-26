"""Console-free Windows startup entry point with bounded local logs."""

from . import store


def logging_config(directory):
    directory.mkdir(parents=True, exist_ok=True)
    return {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "plain": {"format": "%(asctime)s %(levelname)s %(name)s: %(message)s"}
        },
        "handlers": {
            "file": {
                "class": "logging.handlers.RotatingFileHandler",
                "filename": str(directory / "service.log"),
                "maxBytes": 2_000_000,
                "backupCount": 3,
                "encoding": "utf-8",
                "formatter": "plain",
            }
        },
        "loggers": {
            "uvicorn": {"handlers": ["file"], "level": "INFO", "propagate": False},
            "uvicorn.error": {
                "handlers": ["file"],
                "level": "INFO",
                "propagate": False,
            },
        },
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=8123,
        log_config=logging_config(store.DATA),
        access_log=False,
    )
