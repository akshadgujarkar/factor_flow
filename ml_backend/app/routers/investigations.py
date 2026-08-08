from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional

from app.core.investigations import InvestigationManager
from app.blockchain.service import blockchain_service
from app.blockchain.config import blockchain_settings

router = APIRouter()

class CaseStatusUpdate(BaseModel):
    status: str
    note: Optional[str] = None

@router.get("/investigations", summary="Get all active and resolved investigation cases")
def get_investigations():
    return InvestigationManager.get_all()

@router.get("/investigations/{case_id}", summary="Get case details by ID")
def get_case(case_id: str):
    case = InvestigationManager.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return case

@router.patch("/investigations/{case_id}", summary="Update case status")
async def update_case_status(case_id: str, payload: CaseStatusUpdate):
    case = await InvestigationManager.update_status(case_id, payload.status, payload.note)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return case

@router.post("/investigations/{case_id}/blockchain", summary="Anchor confirmed fraud case to blockchain")
async def anchor_case_to_blockchain(case_id: str, background_tasks: BackgroundTasks):
    case = InvestigationManager.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
        
    if not blockchain_settings.BLOCKCHAIN_ENABLED:
        raise HTTPException(status_code=400, detail="Blockchain integration is disabled")

    # Change status to Confirmed Fraud immediately
    await InvestigationManager.update_status(case_id, "Confirmed Fraud", "Anchored to blockchain")

    def _record_and_update():
        result = blockchain_service.record_alert(
            trade_id=case["trade_id"],
            trader_id=case["trader_id"],
            risk_score=case["risk_score"],
            severity=case["severity"],
            shap_explanations=case.get("shap_explanations", []),
            shap_proof_hash=None
        )
        
        if result.get("success") or result.get("already_recorded"):
            import asyncio
            tx_hash = result.get("transaction_hash", "0xAlreadyRecorded")
            
            # Update the case with the tx_hash
            # Since this runs in a threadpool (background task), we need to handle the async call carefully
            try:
                loop = asyncio.get_running_loop()
                asyncio.run_coroutine_threadsafe(
                    InvestigationManager.set_blockchain_hash(case_id, tx_hash),
                    loop
                )
            except RuntimeError:
                # Fallback if no running event loop
                asyncio.run(InvestigationManager.set_blockchain_hash(case_id, tx_hash))

    background_tasks.add_task(_record_and_update)

    return {
        "status": "queued",
        "message": f"Blockchain anchoring for case {case_id} queued.",
        "case": InvestigationManager.get_case(case_id)
    }
