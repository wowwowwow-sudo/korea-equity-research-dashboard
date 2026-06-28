import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import streamlit as st
from ui.sidebar import render_sidebar

st.set_page_config(
    page_title="KR Equity Research Dashboard",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded",
)

render_sidebar()

# 랜딩 즉시 섹터 그리드로 이동
st.switch_page("pages/1_sector_grid.py")
