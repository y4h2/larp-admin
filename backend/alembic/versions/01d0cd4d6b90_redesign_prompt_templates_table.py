"""redesign_prompt_templates_table

Revision ID: 01d0cd4d6b90
Revises: 9adf9aa2f35b
Create Date: 2025-11-24 21:56:46.690545

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '01d0cd4d6b90'
down_revision: Union[str, None] = '9adf9aa2f35b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop existing data first (if any) since enum values are changing
    op.execute("DELETE FROM prompt_templates")

    # Drop old columns
    op.drop_column('prompt_templates', 'variables_meta')
    op.drop_column('prompt_templates', 'scope_target_id')
    op.drop_column('prompt_templates', 'created_by')
    op.drop_column('prompt_templates', 'updated_by')
    op.drop_column('prompt_templates', 'scope_type')
    op.drop_column('prompt_templates', 'status')

    # Update enum type - drop and recreate with new values
    op.execute("ALTER TABLE prompt_templates ALTER COLUMN type DROP DEFAULT")
    op.execute("ALTER TABLE prompt_templates ALTER COLUMN type TYPE VARCHAR(50)")
    op.execute("DROP TYPE IF EXISTS template_type")
    op.execute("CREATE TYPE template_type AS ENUM ('clue_embedding', 'npc_system_prompt', 'clue_reveal', 'custom')")
    op.execute("ALTER TABLE prompt_templates ALTER COLUMN type TYPE template_type USING type::template_type")

    # Drop old enum types
    op.execute("DROP TYPE IF EXISTS template_scope_type")
    op.execute("DROP TYPE IF EXISTS template_status")

    # Add new columns
    op.add_column('prompt_templates', sa.Column('is_default', sa.Boolean(), nullable=False, server_default='false', comment='Whether this is the default template for its type'))
    op.add_column('prompt_templates', sa.Column('variables', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='[]', comment='Auto-extracted variable names from content'))
    op.add_column('prompt_templates', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))

    # Update column comments
    op.alter_column('prompt_templates', 'name',
               existing_type=sa.VARCHAR(length=255),
               comment='Template display name',
               existing_nullable=False)
    op.alter_column('prompt_templates', 'description',
               existing_type=sa.TEXT(),
               comment='Template description',
               existing_nullable=True)
    op.alter_column('prompt_templates', 'type',
               comment='Template type/purpose',
               existing_nullable=False)
    op.alter_column('prompt_templates', 'content',
               existing_type=sa.TEXT(),
               comment='Template content with {var.path} placeholders',
               existing_nullable=False)

    # Create indexes
    op.create_index(op.f('ix_prompt_templates_deleted_at'), 'prompt_templates', ['deleted_at'], unique=False)
    op.create_index(op.f('ix_prompt_templates_is_default'), 'prompt_templates', ['is_default'], unique=False)
    op.create_index(op.f('ix_prompt_templates_name'), 'prompt_templates', ['name'], unique=False)
    op.create_index(op.f('ix_prompt_templates_type'), 'prompt_templates', ['type'], unique=False)


def downgrade() -> None:
    # Drop indexes
    op.drop_index(op.f('ix_prompt_templates_type'), table_name='prompt_templates')
    op.drop_index(op.f('ix_prompt_templates_name'), table_name='prompt_templates')
    op.drop_index(op.f('ix_prompt_templates_is_default'), table_name='prompt_templates')
    op.drop_index(op.f('ix_prompt_templates_deleted_at'), table_name='prompt_templates')

    # Drop new columns
    op.drop_column('prompt_templates', 'deleted_at')
    op.drop_column('prompt_templates', 'variables')
    op.drop_column('prompt_templates', 'is_default')

    # Restore enum type
    op.execute("ALTER TABLE prompt_templates ALTER COLUMN type TYPE VARCHAR(50)")
    op.execute("DROP TYPE IF EXISTS template_type")
    op.execute("CREATE TYPE template_type AS ENUM ('system', 'npc_dialog', 'clue_explain')")
    op.execute("ALTER TABLE prompt_templates ALTER COLUMN type TYPE template_type USING 'system'::template_type")

    # Recreate old enum types
    op.execute("CREATE TYPE template_scope_type AS ENUM ('global', 'script', 'npc')")
    op.execute("CREATE TYPE template_status AS ENUM ('draft', 'active', 'archived')")

    # Add old columns back
    op.add_column('prompt_templates', sa.Column('status', postgresql.ENUM('draft', 'active', 'archived', name='template_status'), autoincrement=False, nullable=False, server_default='draft'))
    op.add_column('prompt_templates', sa.Column('scope_type', postgresql.ENUM('global', 'script', 'npc', name='template_scope_type'), autoincrement=False, nullable=False, server_default='global'))
    op.add_column('prompt_templates', sa.Column('updated_by', sa.VARCHAR(length=255), autoincrement=False, nullable=True))
    op.add_column('prompt_templates', sa.Column('created_by', sa.VARCHAR(length=255), autoincrement=False, nullable=True))
    op.add_column('prompt_templates', sa.Column('scope_target_id', sa.UUID(), autoincrement=False, nullable=True, comment='Target ID for script/npc scope'))
    op.add_column('prompt_templates', sa.Column('variables_meta', postgresql.JSONB(astext_type=sa.Text()), autoincrement=False, nullable=False, server_default='{}', comment='Metadata about used variables for validation'))
