"""add published_at to articles

Revision ID: 001_add_published_at
Revises: 
Create Date: 2026-01-13 20:21:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001_add_published_at'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add published_at column to articles table
    op.add_column('articles', sa.Column('published_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    # Remove published_at column from articles table
    op.drop_column('articles', 'published_at')

