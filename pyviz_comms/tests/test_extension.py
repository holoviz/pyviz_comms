import builtins

import pytest

import pyviz_comms
from pyviz_comms import extension

# Store the default values to reset them in the get_ipython fixture
LAST_EXECUTION_COUNT = extension._last_execution_count
REPEAT_EXECUTION_IN_CELL = extension._repeat_execution_in_cell


@pytest.fixture
def get_ipython():
    # Provide a mock on which `get_ipython().execution_count` returns
    # an integer.

    class ExecutionCount:
        execution_count = 1

        @classmethod
        def bump(cls):
            # Used to emulate running code in the next cell.
            cls.execution_count += 1

    def _get_ipython():
        return ExecutionCount

    builtins.get_ipython = _get_ipython
    pyviz_comms._in_ipython = True

    yield _get_ipython

    extension._last_execution_count = LAST_EXECUTION_COUNT
    extension._repeat_execution_in_cell = REPEAT_EXECUTION_IN_CELL


def test_get_ipython_fixture(get_ipython):
    # Test the get_ipython fixture

    class sub_extension(extension):
        def __call__(self, *args, **params):
            pass

    sub_extension()

    assert sub_extension._last_execution_count == 1

    sub_extension()

    assert sub_extension._last_execution_count == 1

    get_ipython().bump()

    sub_extension()

    assert sub_extension._last_execution_count == 2


def test_get_ipython_fixture_reset(get_ipython):

    assert extension._last_execution_count == LAST_EXECUTION_COUNT
    assert extension._repeat_execution_in_cell == REPEAT_EXECUTION_IN_CELL


def test_extension_count_one_cell_one_extension(get_ipython):

    class sub_extension(extension):
        def __call__(self, *args, **params):
            pass

    sub_extension()

    assert sub_extension._repeat_execution_in_cell is False
    assert sub_extension._repeat_execution_in_cell == extension._repeat_execution_in_cell

    sub_extension()

    assert sub_extension._repeat_execution_in_cell is True
    assert sub_extension._repeat_execution_in_cell == extension._repeat_execution_in_cell

    sub_extension()

    assert sub_extension._repeat_execution_in_cell is True
    assert sub_extension._repeat_execution_in_cell == extension._repeat_execution_in_cell


def test_extension_count_one_cell_extensions_branched(get_ipython):

    class sub_extension1(extension):
        def __call__(self, *args, **params):
            pass

    class sub_extension2(extension):
        def __call__(self, *args, **params):
            pass

    sub_extension1()

    assert sub_extension1._repeat_execution_in_cell is False

    sub_extension2()

    assert sub_extension2._repeat_execution_in_cell is True
    assert sub_extension2._repeat_execution_in_cell == sub_extension1._repeat_execution_in_cell
    assert sub_extension1._repeat_execution_in_cell == extension._repeat_execution_in_cell


def test_extension_count_one_cell_parent_first(get_ipython):

    class parent_extension(extension):
        def __call__(self, *args, **params):
            pass

    class sub_extension(parent_extension):
        def __call__(self, *args, **params):
            pass

    parent_extension()

    assert parent_extension._repeat_execution_in_cell is False

    sub_extension()

    assert sub_extension._repeat_execution_in_cell is True

    parent_extension()

    assert parent_extension._repeat_execution_in_cell is True


def test_extension_count_one_cell_subclass_first(get_ipython):

    class parent_extension(extension):
        def __call__(self, *args, **params):
            pass

    class sub_extension(parent_extension):
        def __call__(self, *args, **params):
            pass

    sub_extension()

    assert sub_extension._repeat_execution_in_cell is False

    parent_extension()

    assert parent_extension._repeat_execution_in_cell is True


def test_extension_count_two_cells_one_extension(get_ipython):

    class sub_extension(extension):
        def __call__(self, *args, **params):
            pass

    sub_extension()

    get_ipython().bump()

    sub_extension()

    assert sub_extension._repeat_execution_in_cell is False
    assert sub_extension._repeat_execution_in_cell == extension._repeat_execution_in_cell

    sub_extension()

    assert sub_extension._repeat_execution_in_cell is True
    assert sub_extension._repeat_execution_in_cell == extension._repeat_execution_in_cell

    get_ipython().bump()

    sub_extension()

    assert sub_extension._repeat_execution_in_cell is False
    assert sub_extension._repeat_execution_in_cell == extension._repeat_execution_in_cell


def test_extension_count_two_cells_extensions_branched(get_ipython):


    class sub_extension1(extension):
        def __call__(self, *args, **params):
            pass

    class sub_extension2(extension):
        def __call__(self, *args, **params):
            pass

    sub_extension1()

    get_ipython().bump()

    sub_extension2()

    assert sub_extension2._repeat_execution_in_cell is False
    assert sub_extension2._repeat_execution_in_cell == sub_extension1._repeat_execution_in_cell
    assert sub_extension1._repeat_execution_in_cell == extension._repeat_execution_in_cell

    sub_extension2()

    assert sub_extension2._repeat_execution_in_cell is True
    assert sub_extension2._repeat_execution_in_cell == sub_extension1._repeat_execution_in_cell
    assert sub_extension1._repeat_execution_in_cell == extension._repeat_execution_in_cell

    get_ipython().bump()

    sub_extension1()

    assert sub_extension1._repeat_execution_in_cell is False
    assert sub_extension1._repeat_execution_in_cell == sub_extension2._repeat_execution_in_cell
    assert sub_extension2._repeat_execution_in_cell == extension._repeat_execution_in_cell

    get_ipython().bump()

    sub_extension2()

    assert sub_extension2._repeat_execution_in_cell is False
    assert sub_extension2._repeat_execution_in_cell == sub_extension1._repeat_execution_in_cell
    assert sub_extension1._repeat_execution_in_cell == extension._repeat_execution_in_cell


def test_extension_count_two_cells_parent_first(get_ipython):

    class parent_extension(extension):
        def __call__(self, *args, **params):
            pass

    class sub_extension(parent_extension):
        def __call__(self, *args, **params):
            pass

    parent_extension()

    get_ipython().bump()

    sub_extension()

    assert sub_extension._repeat_execution_in_cell is False
    assert sub_extension._repeat_execution_in_cell == parent_extension._repeat_execution_in_cell
    assert parent_extension._repeat_execution_in_cell == extension._repeat_execution_in_cell

    sub_extension()

    assert sub_extension._repeat_execution_in_cell is True
    assert sub_extension._repeat_execution_in_cell == parent_extension._repeat_execution_in_cell
    assert parent_extension._repeat_execution_in_cell == extension._repeat_execution_in_cell

    parent_extension()

    assert parent_extension._repeat_execution_in_cell is True
    assert parent_extension._repeat_execution_in_cell == sub_extension._repeat_execution_in_cell
    assert sub_extension._repeat_execution_in_cell == extension._repeat_execution_in_cell

    get_ipython().bump()

    parent_extension()

    assert parent_extension._repeat_execution_in_cell is False
    assert parent_extension._repeat_execution_in_cell == sub_extension._repeat_execution_in_cell
    assert sub_extension._repeat_execution_in_cell == extension._repeat_execution_in_cell


def test_extension_count_two_cells_subclass_first(get_ipython):

    class parent_extension(extension):
        def __call__(self, *args, **params):
            pass

    class sub_extension(parent_extension):
        def __call__(self, *args, **params):
            pass

    sub_extension()

    get_ipython().bump()

    parent_extension()

    assert parent_extension._repeat_execution_in_cell is False
    assert parent_extension._repeat_execution_in_cell == sub_extension._repeat_execution_in_cell
    assert sub_extension._repeat_execution_in_cell == extension._repeat_execution_in_cell

    parent_extension()

    assert parent_extension._repeat_execution_in_cell is True
    assert parent_extension._repeat_execution_in_cell == sub_extension._repeat_execution_in_cell
    assert sub_extension._repeat_execution_in_cell == extension._repeat_execution_in_cell

    sub_extension()

    assert sub_extension._repeat_execution_in_cell is True
    assert sub_extension._repeat_execution_in_cell == parent_extension._repeat_execution_in_cell
    assert parent_extension._repeat_execution_in_cell == extension._repeat_execution_in_cell

    get_ipython().bump()

    sub_extension()

    assert sub_extension._repeat_execution_in_cell is False
    assert sub_extension._repeat_execution_in_cell == parent_extension._repeat_execution_in_cell
    assert parent_extension._repeat_execution_in_cell == extension._repeat_execution_in_cell
