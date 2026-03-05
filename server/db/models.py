"""SQLAlchemy models for the Virtual Scrum Member demo."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _new_id() -> str:
    return str(uuid.uuid4())


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    story_key: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    story_json: Mapped[str] = mapped_column(Text, nullable=False)  # JSON snapshot of story
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="idle")  # idle|building|done
    session_id: Mapped[str | None] = mapped_column(Text, nullable=True)  # claude-agent-sdk session
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    messages: Mapped[list["Message"]] = relationship(
        "Message", back_populates="conversation", cascade="all, delete-orphan",
        order_by="Message.created_at"
    )
    assets: Mapped[list["Asset"]] = relationship(
        "Asset", back_populates="conversation", cascade="all, delete-orphan",
        order_by="Asset.created_at"
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "story_key": self.story_key,
            "status": self.status,
            "session_id": self.session_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "message_count": len(self.messages) if self.messages else 0,
        }


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    conversation_id: Mapped[str] = mapped_column(ForeignKey("conversations.id"), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # user|assistant
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # message_type: text|tool_use|tool_result|thinking|summary
    message_type: Mapped[str] = mapped_column(String(20), nullable=False, default="text")
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON: tool name, input, etc.
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    conversation: Mapped["Conversation"] = relationship("Conversation", back_populates="messages")

    def to_dict(self) -> dict:
        import json
        return {
            "id": self.id,
            "role": self.role,
            "content": self.content,
            "message_type": self.message_type,
            "metadata": json.loads(self.metadata_json) if self.metadata_json else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Asset(Base):
    __tablename__ = "assets"
    __table_args__ = (
        Index("ix_assets_story_key", "story_key"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    conversation_id: Mapped[str] = mapped_column(ForeignKey("conversations.id"), nullable=False)
    story_key: Mapped[str] = mapped_column(String(50), nullable=False)
    # asset_type: pipeline|table|dashboard|endpoint|job|schema|notebook
    asset_type: Mapped[str] = mapped_column(String(30), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    url: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Unity Catalog location fields
    catalog: Mapped[str | None] = mapped_column(String(255), nullable=True)
    schema_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    full_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    conversation: Mapped["Conversation"] = relationship("Conversation", back_populates="assets")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "conversation_id": self.conversation_id,
            "story_key": self.story_key,
            "asset_type": self.asset_type,
            "name": self.name,
            "url": self.url,
            "description": self.description,
            "catalog": self.catalog,
            "schema_name": self.schema_name,
            "full_path": self.full_path,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
