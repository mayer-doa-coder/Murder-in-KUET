from engine.cards import Card
from engine.clue_reveal import reveal_clue


class _Player:
    def __init__(self, cards):
        self.cards = cards


class _Suggestion:
    suspect = "Chef"
    weapon = "Knife"
    location = "Auditorium"


def test_reveal_clue_accepts_out_of_range_current_index() -> None:
    players = [
        _Player([]),
        _Player([Card("Knife", "weapon")]),
        _Player([]),
    ]
    suggestion = _Suggestion()

    revealer, card = reveal_clue(suggestion, players, 999)

    assert revealer is players[1]
    assert card is not None
    assert card.name == "Knife"
