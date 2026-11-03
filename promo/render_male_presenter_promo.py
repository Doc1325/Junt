#!/usr/bin/env python3
"""Renderiza la variante masculina sin alterar el video con presentadora."""

import os

os.environ["JUNT_PRESENTER_VARIANT"] = "male"

import render_presenter_promo


if __name__ == "__main__":
    render_presenter_promo.main()
