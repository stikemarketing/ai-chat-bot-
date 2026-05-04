import os
import subprocess

import modal

APP_NAME = "ai-companion-vllm"
MODEL_NAME = "Qwen/Qwen2.5-7B-Instruct"
PORT = 8000

DEV_MODE = os.environ.get("DEV_MODE", "true").lower() == "true"

app = modal.App(APP_NAME)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install_from_requirements("requirements.txt")
)

model_cache = modal.Volume.from_name(
    "ai-companion-model-cache",
    create_if_missing=True,
)

gpu_config = "L4" if DEV_MODE else "L40S"
min_containers = 0 if DEV_MODE else 1
scaledown_window = 5 * 60 if DEV_MODE else 30 * 60
max_model_len = "2048" if DEV_MODE else "4096"
max_num_seqs = "2" if DEV_MODE else "4"


@app.function(
    image=image,
    gpu=gpu_config,
    timeout=60 * 60,
    min_containers=min_containers,
    scaledown_window=scaledown_window,
    volumes={"/models": model_cache},
)
@modal.web_server(port=PORT, startup_timeout=60 * 10)
def serve():
    os.environ["HF_HOME"] = "/models"
    os.environ["HUGGINGFACE_HUB_CACHE"] = "/models"

    command = [
        "vllm",
        "serve",
        MODEL_NAME,
        "--host",
        "0.0.0.0",
        "--port",
        str(PORT),
        "--dtype",
        "auto",
        "--max-model-len",
        max_model_len,
        "--gpu-memory-utilization",
        "0.9",
        "--max-num-seqs",
        max_num_seqs,
    ]

    subprocess.Popen(command)


@app.local_entrypoint()
def main():
    mode = "DEV" if DEV_MODE else "FAST"
    print(f"Deploy mode: {mode}")
    print(f"GPU: {gpu_config}")
    print(f"min_containers: {min_containers}")